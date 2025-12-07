import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { ListTeamsDto } from './dto/list-teams.dto';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  // ---------- CREATE ----------

  async create(dto: CreateTeamDto) {
    const data: any = {
      name: dto.name,
    };

    if (dto.memberIds?.length) {
      data.members = {
        connect: dto.memberIds.map((id) => ({ id })),
      };
    }

    return this.prisma.team.create({
      data,
      include: {
        _count: {
          select: { members: true, incidents: true },
        },
      },
    });
  }

  // ---------- LIST & GET ----------

  async findAll(query: ListTeamsDto) {
    const where: any = {};

    if (query.search) {
      where.name = {
        contains: query.search,
        mode: 'insensitive',
      };
    }

    return this.prisma.team.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { members: true, incidents: true },
        },
      },
    });
  }

  async findForUser(userId: string) {
    return this.prisma.team.findMany({
      where: {
        members: {
          some: { id: userId },
        },
      },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { members: true, incidents: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        members: true,
        _count: {
          select: { incidents: true, members: true },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return team;
  }

  // ---------- MEMBERS ----------

  async listMembers(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        members: true,
      },
    });

    if (!team) throw new NotFoundException('Team not found');

    return team.members;
  }

  async addMember(id: string, userId: string) {
    // garantir que a equipa existe
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException('Team not found');

    // garantir que o user existe
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.team.update({
      where: { id },
      data: {
        members: {
          connect: { id: userId },
        },
      },
      include: {
        members: true,
      },
    });
  }

  async removeMember(id: string, userId: string) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException('Team not found');

    return this.prisma.team.update({
      where: { id },
      data: {
        members: {
          disconnect: { id: userId },
        },
      },
      include: {
        members: true,
      },
    });
  }

  // ---------- UPDATE / DELETE ----------

  async update(id: string, dto: UpdateTeamDto) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException('Team not found');

    const data: any = {};

    if (dto.name !== undefined) data.name = dto.name;

    if (dto.memberIds) {
      // reset completo da membership
      data.members = {
        set: dto.memberIds.map((userId) => ({ id: userId })),
      };
    }

    return this.prisma.team.update({
      where: { id },
      data,
      include: {
        members: true,
        _count: {
          select: { members: true, incidents: true },
        },
      },
    });
  }

  async remove(id: string) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException('Team not found');

    await this.prisma.team.delete({
      where: { id },
    });

    return { deleted: true };
  }
}
