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

@Injectable()
export class IncidentsService {
  constructor(private prisma: PrismaService) { }

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

    return this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.create({
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
          incidentId: incident.id,
          authorId: reporterId,
          type: TimelineEventType.STATUS_CHANGE,
          fromStatus: null,
          toStatus: IncidentStatus.NEW,
          message: 'Incidente criado',
        },
      });

      await tx.notificationSubscription.create({
        data: { userId: reporterId, incidentId: incident.id },
      });

      if (incident.primaryServiceId) {
        await tx.incidentTimelineEvent.create({
          data: {
            incidentId: incident.id,
            authorId: reporterId,
            type: TimelineEventType.FIELD_UPDATE,
            message: `Serviço definido: ${incident.primaryService?.name ?? 'Service'}`,
          },
        });
      }

      return incident;
    });
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

    const data: Prisma.IncidentUpdateInput = {};

    const titleChanged = dto.title !== undefined && dto.title !== incident.title;
    const descriptionChanged = dto.description !== undefined && dto.description !== incident.description;
    const teamChanged = dto.teamId !== undefined && (dto.teamId || null) !== (incident.teamId ?? null);

    const severityChanged = dto.severity !== undefined && dto.severity !== incident.severity;

    let assigneeChanged = false;
    let serviceChanged = false;

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.severity !== undefined) data.severity = dto.severity;

    // assignee change
    if (dto.assigneeId !== undefined) {
      const newAssigneeId = dto.assigneeId || null;
      assigneeChanged = newAssigneeId !== (incident.assigneeId ?? null);

      data.assignee = newAssigneeId
        ? { connect: { id: newAssigneeId } }
        : { disconnect: true };
    }

    // team change
    if (dto.teamId !== undefined) {
      data.team = dto.teamId ? { connect: { id: dto.teamId } } : { disconnect: true };
    }

    // service change
    const resolvedServiceId = await this.resolvePrimaryServiceId({
      primaryServiceId: dto.primaryServiceId,
      primaryServiceKey: dto.primaryServiceKey,
    });

    let serviceNameForMessage: string | null = null;

    if (resolvedServiceId !== undefined) {
      const current = incident.primaryServiceId ?? null;
      serviceChanged = resolvedServiceId !== current;

      if (resolvedServiceId === null) {
        data.primaryService = { disconnect: true };
      } else {
        data.primaryService = { connect: { id: resolvedServiceId } };
        const svc = await this.prisma.service.findUnique({
          where: { id: resolvedServiceId },
          select: { name: true },
        });
        serviceNameForMessage = svc?.name ?? 'Service';
      }
    }

    // categories/tags (mantive igual ao teu)
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

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.incident.update({
        where: { id },
        data,
        include: {
          reporter: true,
          assignee: true,
          team: true,
          primaryService: { include: { ownerTeam: true } },
        },
      });

      // ✅ criar eventos separados (1 por mudança relevante)
      const events: Prisma.IncidentTimelineEventCreateManyInput[] = [];

      if (serviceChanged) {
        events.push({
          incidentId: id,
          authorId: userId,
          type: TimelineEventType.FIELD_UPDATE,
          message: updated.primaryServiceId
            ? `Serviço atualizado: ${serviceNameForMessage ?? updated.primaryService?.name ?? 'Service'}`
            : 'Serviço removido',
        });
      }

      if (assigneeChanged) {
        const label =
          updated.assignee?.name?.trim()
            ? updated.assignee.name
            : (updated.assignee?.email ?? 'unknown');

        events.push({
          incidentId: id,
          authorId: userId,
          type: TimelineEventType.ASSIGNMENT,
          message: updated.assigneeId
            ? `Responsável atualizado: ${label}`
            : 'Responsável removido',
        });
      }
      if (severityChanged) {
        events.push({
          incidentId: id,
          authorId: userId,
          type: TimelineEventType.FIELD_UPDATE,
          message: `Severidade atualizada: ${incident.severity} → ${updated.severity}`,
        });
      }

      // fallback se mudou “algo” mas não foi service/assignee/severity
      const somethingElseChanged =
        titleChanged || descriptionChanged || teamChanged || !!dto.categoryIds || !!dto.tagIds;

      if (events.length === 0 && somethingElseChanged) {
        events.push({
          incidentId: id,
          authorId: userId,
          type: TimelineEventType.FIELD_UPDATE,
          message: 'Campos atualizados',
        });
      }

      if (events.length > 0) {
        await tx.incidentTimelineEvent.createMany({ data: events });
      }

      return updated;
    });
  }


  async changeStatus(id: string, dto: ChangeStatusDto, userId: string) {
    const incident = await this.prisma.incident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException('Incident not found');

    const from = incident.status;
    const to = dto.newStatus;

    this.validateStatusTransition(from, to);

    const updateData: Prisma.IncidentUpdateInput = { status: to };

    const tsField = this.getStatusTimestampField(to);
    if (tsField && !incident[tsField as keyof typeof incident]) {
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

    return { subscribed: true };
  }

  async unsubscribe(id: string, userId: string) {
    await this.prisma.notificationSubscription.deleteMany({
      where: { userId, incidentId: id },
    });

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
