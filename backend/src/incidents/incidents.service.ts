// src/incidents/incidents.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IncidentStatus,
  Priority,
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
  constructor(private prisma: PrismaService) {}

  // ---------- Helpers ciclo de vida ----------

  private validateStatusTransition(
    current: IncidentStatus,
    next: IncidentStatus,
  ) {
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
      throw new BadRequestException(
        `Transição inválida de ${current} para ${next}`,
      );
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

  // ---------- CREATE ----------

  async create(dto: CreateIncidentDto, reporterId: string) {
    const data: Prisma.IncidentCreateInput = {
      title: dto.title,
      description: dto.description,
      priority: dto.priority ?? Priority.P3,
      status: IncidentStatus.NEW,
      reporter: { connect: { id: reporterId } },
      assignee: dto.assigneeId
        ? { connect: { id: dto.assigneeId } }
        : undefined,
      team: dto.teamId ? { connect: { id: dto.teamId } } : undefined,
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

    // cria o incidente
    const incident = await this.prisma.incident.create({ data });

    // criar evento de timeline + subscription do reporter
    await this.prisma.$transaction([
      this.prisma.incidentTimelineEvent.create({
        data: {
          incidentId: incident.id,
          authorId: reporterId,
          type: TimelineEventType.STATUS_CHANGE,
          fromStatus: null,
          toStatus: IncidentStatus.NEW,
          message: 'Incidente criado',
        },
      }),
      this.prisma.notificationSubscription.create({
        data: {
          userId: reporterId,
          incidentId: incident.id,
        },
      }),
    ]);

    return incident;
  }

  // ---------- LIST & GET ----------

  async findAll(query: ListIncidentsDto) {
    const where: Prisma.IncidentWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.assigneeId) where.assigneeId = query.assigneeId;
    if (query.teamId) where.teamId = query.teamId;

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

  // ---------- UPDATE (sem status) ----------

  async update(id: string, dto: UpdateIncidentDto, userId: string) {
    const incident = await this.prisma.incident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException('Incident not found');

    const data: Prisma.IncidentUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.assigneeId !== undefined) {
      data.assignee = dto.assigneeId
        ? { connect: { id: dto.assigneeId } }
        : { disconnect: true };
    }
    if (dto.teamId !== undefined) {
      data.team = dto.teamId
        ? { connect: { id: dto.teamId } }
        : { disconnect: true };
    }

    if (dto.categoryIds) {
      // limpar categorias antigas e recriar simples
      await this.prisma.categoryOnIncident.deleteMany({
        where: { incidentId: id },
      });
      data.categories = {
        create: dto.categoryIds.map((categoryId) => ({
          category: { connect: { id: categoryId } },
        })),
      };
    }

    if (dto.tagIds) {
      // reset tags
      data.tags = {
        set: dto.tagIds.map((tagId) => ({ id: tagId })),
      };
    }

    const updated = await this.prisma.incident.update({
      where: { id },
      data,
    });

    await this.prisma.incidentTimelineEvent.create({
      data: {
        incidentId: id,
        authorId: userId,
        type: TimelineEventType.FIELD_UPDATE,
        message: 'Fields updated',
      },
    });

    return updated;
  }

  // ---------- CHANGE STATUS ----------

  async changeStatus(id: string, dto: ChangeStatusDto, userId: string) {
    const incident = await this.prisma.incident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException('Incident not found');

    const from = incident.status;
    const to = dto.newStatus;

    this.validateStatusTransition(from, to);

    const updateData: Prisma.IncidentUpdateInput = { status: to };

    const tsField = this.getStatusTimestampField(to);
    if (tsField && !incident[tsField as keyof typeof incident]) {
      // só mete timestamp se ainda não estiver preenchido
      (updateData as any)[tsField] = new Date();
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.incident.update({
        where: { id },
        data: updateData,
      }),
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

  // ---------- COMMENTS ----------

  async addComment(id: string, dto: AddCommentDto, userId: string) {
    const incident = await this.prisma.incident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException('Incident not found');

    const [comment] = await this.prisma.$transaction([
      this.prisma.incidentComment.create({
        data: {
          incidentId: id,
          authorId: userId,
          body: dto.body,
        },
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

  // ---------- TIMELINE ----------

  async listTimeline(id: string) {
    return this.prisma.incidentTimelineEvent.findMany({
      where: { incidentId: id },
      orderBy: { createdAt: 'asc' },
      include: { author: true },
    });
  }

  // ---------- SUBSCRIPTIONS ----------

  async subscribe(id: string, userId: string) {
    // versão simples sem null chato no upsert
    const existing = await this.prisma.notificationSubscription.findFirst({
      where: { userId, incidentId: id },
    });

    if (!existing) {
      await this.prisma.notificationSubscription.create({
        data: {
          userId,
          incidentId: id,
        },
      });
    }

    return { subscribed: true };
  }

  async unsubscribe(id: string, userId: string) {
    await this.prisma.notificationSubscription.deleteMany({
      where: {
        userId,
        incidentId: id,
      },
    });

    return { subscribed: false };
  }
}
