import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  IncidentStatus,
  Severity,
  TimelineEventType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { ListIncidentsDto } from './dto/list-incidents.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ensureIncidentAuditHash } from '../audit/incident-audit';

@Injectable()
export class IncidentsService {
  constructor(
    private prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) { }

  private async refreshAuditHash(incidentId: string) {
    try {
      await ensureIncidentAuditHash(
        this.prisma as any,
        incidentId,
        process.env.AUDIT_HMAC_SECRET,
      );
    } catch {
      // best-effort: não rebenta a operação principal
    }
  }

  private validateStatusTransition(current: IncidentStatus, next: IncidentStatus) {
    const allowed: Record<IncidentStatus, IncidentStatus[]> = {
      NEW: [IncidentStatus.TRIAGED, IncidentStatus.IN_PROGRESS],
      TRIAGED: [
        IncidentStatus.IN_PROGRESS,
        IncidentStatus.ON_HOLD,
        IncidentStatus.RESOLVED,
      ],
      IN_PROGRESS: [IncidentStatus.ON_HOLD, IncidentStatus.RESOLVED],
      ON_HOLD: [IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED],
      RESOLVED: [IncidentStatus.CLOSED, IncidentStatus.REOPENED],
      CLOSED: [IncidentStatus.REOPENED],
      REOPENED: [
        IncidentStatus.IN_PROGRESS,
        IncidentStatus.ON_HOLD,
        IncidentStatus.RESOLVED,
      ],
    };

    const allowedNext = allowed[current] ?? [];
    if (!allowedNext.includes(next)) {
      throw new BadRequestException(`Transição inválida de ${current} para ${next}`);
    }
  }

  private getStatusTimestampField(
    status: IncidentStatus,
  ): keyof Prisma.IncidentUpdateInput | undefined {
    switch (status) {
      case IncidentStatus.TRIAGED:
        return 'triagedAt';
      case IncidentStatus.IN_PROGRESS:
        return 'inProgressAt';
      case IncidentStatus.RESOLVED:
        return 'resolvedAt';
      case IncidentStatus.CLOSED:
        return 'closedAt';
      default:
        return undefined;
    }
  }

  private async resolvePrimaryServiceId(input?: {
    primaryServiceId?: string;
    primaryServiceKey?: string;
  }): Promise<string | null | undefined> {
    if (!input) return undefined;

    if (input.primaryServiceId !== undefined && input.primaryServiceId.trim() === '')
      return null;
    if (input.primaryServiceKey !== undefined && input.primaryServiceKey.trim() === '')
      return null;

    if (input.primaryServiceId) {
      const svc = await this.prisma.service.findUnique({
        where: { id: input.primaryServiceId },
        select: { id: true },
      });
      if (!svc) throw new BadRequestException('Service not found (primaryServiceId)');
      return svc.id;
    }

    if (input.primaryServiceKey) {
      const svc = await this.prisma.service.findUnique({
        where: { key: input.primaryServiceKey },
        select: { id: true },
      });
      if (!svc) throw new BadRequestException('Service not found (primaryServiceKey)');
      return svc.id;
    }

    return undefined;
  }

  async create(dto: CreateIncidentDto, reporterId: string) {
    const resolvedServiceId = await this.resolvePrimaryServiceId({
      primaryServiceId: dto.primaryServiceId,
      primaryServiceKey: dto.primaryServiceKey,
    });

    const data: Prisma.IncidentCreateInput = {
      title: dto.title,
      description: dto.description,
      severity: dto.severity ?? Severity.SEV3,
      status: IncidentStatus.NEW,
      reporter: { connect: { id: reporterId } },
      assignee: dto.assigneeId ? { connect: { id: dto.assigneeId } } : undefined,
      team: dto.teamId ? { connect: { id: dto.teamId } } : undefined,
      primaryService:
        resolvedServiceId && resolvedServiceId !== null
          ? { connect: { id: resolvedServiceId } }
          : undefined,
      categories: dto.categoryIds
        ? {
          create: dto.categoryIds.map((categoryId) => ({
            category: { connect: { id: categoryId } },
          })),
        }
        : undefined,
      tags: dto.tagIds
        ? {
          connect: dto.tagIds.map((tagId) => ({ id: tagId })),
        }
        : undefined,
    };

    const incident = await this.prisma.$transaction(async (tx) => {
      const created = await tx.incident.create({
        data,
        include: {
          reporter: true,
          assignee: true,
          team: true,
          primaryService: { include: { ownerTeam: true } },
        },
      });

      await tx.incidentTimelineEvent.create({
        data: {
          incidentId: created.id,
          authorId: reporterId,
          type: TimelineEventType.STATUS_CHANGE,
          fromStatus: null,
          toStatus: IncidentStatus.NEW,
          message: 'Incidente criado',
        },
      });

      await tx.notificationSubscription.create({
        data: { userId: reporterId, incidentId: created.id },
      });

      if (created.primaryServiceId) {
        await tx.incidentTimelineEvent.create({
          data: {
            incidentId: created.id,
            authorId: reporterId,
            type: TimelineEventType.FIELD_UPDATE,
            message: `Serviço definido: ${created.primaryService?.name ?? 'Service'}`,
          },
        });
      }

      if (created.severity === Severity.SEV1 || created.severity === Severity.SEV2) {
        const shortId = created.id.slice(0, 8).toUpperCase();
        const service = created.primaryService?.name ?? '—';
        const team = created.team?.name ?? '—';
        const owner =
          created.assignee?.name ??
          created.assignee?.email ??
          'Sem owner';

        const url = process.env.FRONTEND_BASE_URL
          ? `${process.env.FRONTEND_BASE_URL}/incidents/${created.id}`
          : null;

        const msg =
          `🚨 **${created.severity}** | **${created.title}**\n` +
          `• ID: \`${shortId}\`\n` +
          `• Status: **${created.status}**\n` +
          `• Serviço: **${service}**\n` +
          `• Equipa: **${team}**\n` +
          `• Owner: **${owner}**\n` +
          (url ? `• Link: ${url}` : '');

        const discord = await this.notificationsService.sendDiscord(msg);

        const pagerduty = await this.notificationsService.triggerPagerDuty(
          created.title,
          created.severity,
          created.id,
        );

        await tx.incidentTimelineEvent.create({
          data: {
            incidentId: created.id,
            authorId: reporterId,
            type: TimelineEventType.FIELD_UPDATE,
            message: `Notificações: Discord=${discord.ok ? 'OK' : 'FAIL'} | PagerDuty=${pagerduty.ok ? 'OK' : 'FAIL'}`,
          },
        });
      }

      return created;
    });

    await this.refreshAuditHash(incident.id);
    return incident;
  }

  async findAll(query: ListIncidentsDto) {
    const where: Prisma.IncidentWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;
    if (query.assigneeId) where.assigneeId = query.assigneeId;
    if (query.teamId) where.teamId = query.teamId;

    if (query.primaryServiceId) where.primaryServiceId = query.primaryServiceId;

    if (query.primaryServiceKey) {
      const svc = await this.prisma.service.findUnique({
        where: { key: query.primaryServiceKey },
        select: { id: true },
      });
      if (!svc) return [];
      where.primaryServiceId = svc.id;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.createdFrom || query.createdTo) {
      where.createdAt = {};
      if (query.createdFrom) where.createdAt.gte = query.createdFrom;
      if (query.createdTo) where.createdAt.lte = query.createdTo;
    }

    return this.prisma.incident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: true,
        assignee: true,
        team: true,
        primaryService: { include: { ownerTeam: true } },
      },
    });
  }

  async findOne(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        reporter: true,
        assignee: true,
        team: true,
        primaryService: { include: { ownerTeam: true } },
        categories: { include: { category: true } },
        tags: true,
        capas: { orderBy: { createdAt: 'asc' }, include: { owner: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: true },
        },
        timeline: {
          orderBy: { createdAt: 'asc' },
          include: { author: true },
        },
        sources: {
          include: { integration: true },
        },
      },
    });

    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }

  private async prepareUpdateData(
    id: string,
    incident: {
      title: string;
      description: string | null;
      severity: Severity;
      assigneeId: string | null;
      teamId: string | null;
      primaryServiceId: string | null;
    },
    dto: UpdateIncidentDto,
  ) {
    const data: Prisma.IncidentUpdateInput = {};
    const changes = {
      assigneeChanged: false,
      serviceChanged: false,
      severityChanged: false,
      otherChanges: false,
      serviceNameForMessage: null as string | null,
    };

    const titleChanged = dto.title !== undefined && dto.title !== incident.title;
    const descriptionChanged =
      dto.description !== undefined && dto.description !== incident.description;
    const teamChanged =
      dto.teamId !== undefined && (dto.teamId || null) !== (incident.teamId ?? null);

    changes.severityChanged =
      dto.severity !== undefined && dto.severity !== incident.severity;

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.severity !== undefined) data.severity = dto.severity;

    // Assignee
    if (dto.assigneeId !== undefined) {
      const newAssigneeId = dto.assigneeId || null;
      changes.assigneeChanged = newAssigneeId !== (incident.assigneeId ?? null);
      data.assignee = newAssigneeId
        ? { connect: { id: newAssigneeId } }
        : { disconnect: true };
    }

    // Team
    if (dto.teamId !== undefined) {
      data.team = dto.teamId ? { connect: { id: dto.teamId } } : { disconnect: true };
    }

    // Service
    const resolvedServiceId = await this.resolvePrimaryServiceId({
      primaryServiceId: dto.primaryServiceId,
      primaryServiceKey: dto.primaryServiceKey,
    });

    if (resolvedServiceId !== undefined) {
      const current = incident.primaryServiceId ?? null;
      changes.serviceChanged = resolvedServiceId !== current;

      if (resolvedServiceId === null) {
        data.primaryService = { disconnect: true };
      } else {
        data.primaryService = { connect: { id: resolvedServiceId } };
        const svc = await this.prisma.service.findUnique({
          where: { id: resolvedServiceId },
          select: { name: true },
        });
        changes.serviceNameForMessage = svc?.name ?? 'Service';
      }
    }

    // Categories (side-effect)
    if (dto.categoryIds) {
      await this.prisma.categoryOnIncident.deleteMany({ where: { incidentId: id } });
      data.categories = {
        create: dto.categoryIds.map((categoryId) => ({
          category: { connect: { id: categoryId } },
        })),
      };
    }

    if (dto.tagIds) {
      data.tags = { set: dto.tagIds.map((tagId) => ({ id: tagId })) };
    }

    changes.otherChanges =
      titleChanged ||
      descriptionChanged ||
      teamChanged ||
      !!dto.categoryIds ||
      !!dto.tagIds;

    return { data, changes };
  }

  private generateUpdateEvents(
    userId: string,
    u: any, // Updated incident
    incident: any, // Original incident
    changes: {
      assigneeChanged: boolean;
      serviceChanged: boolean;
      severityChanged: boolean;
      otherChanges: boolean;
      serviceNameForMessage: string | null;
    },
  ) {
    const events: Prisma.IncidentTimelineEventCreateManyInput[] = [];

    if (changes.serviceChanged) {
      events.push({
        incidentId: u.id,
        authorId: userId,
        type: TimelineEventType.FIELD_UPDATE,
        message: u.primaryServiceId
          ? `Serviço atualizado: ${changes.serviceNameForMessage ?? u.primaryService?.name ?? 'Service'}`
          : 'Serviço removido',
      });
    }

    if (changes.assigneeChanged) {
      const label =
        u.assignee?.name?.trim() ? u.assignee.name : u.assignee?.email ?? 'unknown';

      events.push({
        incidentId: u.id,
        authorId: userId,
        type: TimelineEventType.ASSIGNMENT,
        message: u.assigneeId
          ? `Responsável atualizado: ${label}`
          : 'Responsável removido',
      });
    }

    if (changes.severityChanged) {
      events.push({
        incidentId: u.id,
        authorId: userId,
        type: TimelineEventType.FIELD_UPDATE,
        message: `Severidade atualizada: ${incident.severity} → ${u.severity}`,
      });
    }

    if (events.length === 0 && changes.otherChanges) {
      events.push({
        incidentId: u.id,
        authorId: userId,
        type: TimelineEventType.FIELD_UPDATE,
        message: 'Campos atualizados',
      });
    }

    return events;
  }

  async update(id: string, dto: UpdateIncidentDto, userId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        severity: true,
        assigneeId: true,
        teamId: true,
        primaryServiceId: true,
      },
    });
    if (!incident) throw new NotFoundException('Incident not found');

    const { data, changes } = await this.prepareUpdateData(id, incident, dto);

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.incident.update({
        where: { id },
        data,
        include: {
          reporter: true,
          assignee: true,
          team: true,
          primaryService: { include: { ownerTeam: true } },
        },
      });

      const events = this.generateUpdateEvents(userId, u, incident, changes);
      if (events.length > 0) {
        await tx.incidentTimelineEvent.createMany({ data: events });
      }

      return u;
    });

    await this.refreshAuditHash(id);
    return updated;
  }

  async changeStatus(id: string, dto: ChangeStatusDto, userId: string) {
    const incident = await this.prisma.incident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException('Incident not found');

    const from = incident.status;
    const to = dto.newStatus;

    this.validateStatusTransition(from, to);

    const updateData: Prisma.IncidentUpdateInput = { status: to };

    const tsField = this.getStatusTimestampField(to);
    if (tsField && !(incident as any)[tsField]) {
      (updateData as any)[tsField] = new Date();
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.incident.update({ where: { id }, data: updateData }),
      this.prisma.incidentTimelineEvent.create({
        data: {
          incidentId: id,
          authorId: userId,
          type: TimelineEventType.STATUS_CHANGE,
          fromStatus: from,
          toStatus: to,
          message: dto.message ?? `Status changed to ${to}`,
        },
      }),
    ]);

    if (updated.severity === Severity.SEV1 || updated.severity === Severity.SEV2) {
      const msg = `📣 ${updated.severity} | ${updated.title} | status: ${from} → ${to}`;
      const discord = await this.notificationsService.sendDiscord(msg);

      await this.prisma.incidentTimelineEvent.create({
        data: {
          incidentId: id,
          authorId: userId,
          type: TimelineEventType.FIELD_UPDATE,
          message: `Notificação de status: Discord=${discord.ok ? 'OK' : 'FAIL'}`,
        },
      });
    }

    await this.refreshAuditHash(id);
    return updated;
  }

  async addComment(id: string, dto: AddCommentDto, userId: string) {
    const incident = await this.prisma.incident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException('Incident not found');

    const [comment] = await this.prisma.$transaction([
      this.prisma.incidentComment.create({
        data: { incidentId: id, authorId: userId, body: dto.body },
      }),
      this.prisma.incidentTimelineEvent.create({
        data: {
          incidentId: id,
          authorId: userId,
          type: TimelineEventType.COMMENT,
          message: dto.body,
        },
      }),
    ]);

    await this.refreshAuditHash(id);
    return comment;
  }

  async listComments(id: string) {
    return this.prisma.incidentComment.findMany({
      where: { incidentId: id },
      orderBy: { createdAt: 'asc' },
      include: { author: true },
    });
  }

  async listTimeline(id: string) {
    return this.prisma.incidentTimelineEvent.findMany({
      where: { incidentId: id },
      orderBy: { createdAt: 'asc' },
      include: { author: true },
    });
  }

  async subscribe(id: string, userId: string) {
    const existing = await this.prisma.notificationSubscription.findFirst({
      where: { userId, incidentId: id },
    });

    if (!existing) {
      await this.prisma.notificationSubscription.create({
        data: { userId, incidentId: id },
      });
    }

    await this.prisma.incidentTimelineEvent.create({
      data: {
        incidentId: id,
        authorId: userId,
        type: TimelineEventType.FIELD_UPDATE,
        message: 'Subscrição de notificações ativada',
      },
    });

    await this.refreshAuditHash(id);
    return { subscribed: true };
  }

  async unsubscribe(id: string, userId: string) {
    await this.prisma.notificationSubscription.deleteMany({
      where: { userId, incidentId: id },
    });

    await this.prisma.incidentTimelineEvent.create({
      data: {
        incidentId: id,
        authorId: userId,
        type: TimelineEventType.FIELD_UPDATE,
        message: 'Subscrição de notificações desativada',
      },
    });

    await this.refreshAuditHash(id);
    return { subscribed: false };
  }

  async delete(id: string, userId: string) {
    const incident = await this.prisma.incident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException('Incident not found');

    if (incident.reporterId !== userId) {
      throw new ForbiddenException('Only the reporter can delete this incident');
    }

    await this.prisma.$transaction([
      this.prisma.incidentComment.deleteMany({ where: { incidentId: id } }),
      this.prisma.incidentTimelineEvent.deleteMany({ where: { incidentId: id } }),
      this.prisma.notificationSubscription.deleteMany({ where: { incidentId: id } }),
      this.prisma.categoryOnIncident.deleteMany({ where: { incidentId: id } }),
      this.prisma.incident.delete({ where: { id } }),
    ]);

    return { deleted: true };
  }
}