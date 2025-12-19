// src/teams/teams.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { ListTeamsDto } from './dto/list-teams.dto';

/**
 * Service de domínio para Equipas (Teams).
 *
 * ## Responsabilidade
 * - CRUD de equipas (`Team`)
 * - Gestão de membros (relação `Team.members`)
 *
 * ## Regras principais de negócio
 * - `addMember`: um utilizador deve pertencer a **apenas 1 equipa**
 *   - remove o user de todas as outras equipas
 *   - adiciona o user à equipa alvo
 *
 * ## Acesso a dados
 * Usa `PrismaService` (Prisma Client) com:
 * - `team.create/findMany/findUnique/update/delete`
 * - `user.findUnique`
 * - `prisma.$transaction` para garantir consistência ao mover membro entre equipas
 *
 * ## Erros
 * - `NotFoundException('Team not found')` para equipa inexistente
 * - `NotFoundException('User not found')` para utilizador inexistente em `addMember`
 */
@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  // ---------- CREATE ----------

  /**
   * Cria uma equipa e (opcionalmente) liga membros via `connect`.
   *
   * @param dto Nome da equipa e lista opcional de `memberIds`.
   * @returns Equipa criada com `_count` (members/incidents).
   *
   * @remarks
   * - Não valida se `memberIds` existem; o Prisma pode falhar se IDs forem inválidos.
   * - Não aplica a regra “um user só pode estar em 1 equipa” aqui.
   */
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

  /**
   * Lista equipas com filtro opcional por nome.
   *
   * @param query Query params (`search`).
   * @returns Lista ordenada por `name` asc com `_count`.
   */
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

  /**
   * Lista equipas onde o utilizador é membro.
   *
   * @param userId ID do utilizador
   * @returns Equipas do utilizador com `_count`
   */
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

  /**
   * Obtém uma equipa por ID, incluindo membros.
   *
   * @param id ID da equipa
   * @returns Equipa com `members` e `_count`
   * @throws NotFoundException Se não existir
   */
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

  /**
   * Lista membros de uma equipa.
   *
   * @param id ID da equipa
   * @returns Lista de users membros
   * @throws NotFoundException Se a equipa não existir
   */
  async listMembers(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!team) throw new NotFoundException('Team not found');
    return team.members;
  }

  /**
   * Adiciona um utilizador a uma equipa, garantindo a regra:
   * **um user só pode estar em 1 equipa**.
   *
   * ## Algoritmo
   * 1) Valida existência da equipa e do user
   * 2) Dentro de uma transaction:
   *    - encontra todas as equipas atuais do user
   *    - remove o user de todas as equipas exceto a target
   *    - adiciona o user à target (se ainda não estiver)
   *    - devolve a equipa target com `members`
   *
   * @param id ID da equipa alvo
   * @param userId ID do utilizador a mover/adicionar
   * @returns Equipa alvo com `members` atualizados
   *
   * @throws NotFoundException Se equipa ou user não existirem
   *
   * @remarks
   * - A transação reduz risco de estados intermédios inconsistentes.
   * - Se o user já estiver na equipa target, devolve a equipa atualizada.
   */
  async addMember(id: string, userId: string) {
    // checks fora do tx (rápido e simples)
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException('Team not found');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.$transaction(async (tx) => {
      // equipas atuais do user (pode estar em várias)
      const currentTeams = await tx.team.findMany({
        where: { members: { some: { id: userId } } },
        select: { id: true },
      });

      const alreadyInTarget = currentTeams.some((t) => t.id === id);

      // 1) disconnect de todas as equipas menos a target
      for (const t of currentTeams) {
        if (t.id === id) continue;

        await tx.team.update({
          where: { id: t.id },
          data: { members: { disconnect: { id: userId } } },
        });
      }

      // 2) connect na target (se ainda não estiver)
      if (!alreadyInTarget) {
        return tx.team.update({
          where: { id },
          data: { members: { connect: { id: userId } } },
          include: { members: true },
        });
      }

      // 3) se já estava na target, devolve a target com members atualizados
      const updated = await tx.team.findUnique({
        where: { id },
        include: { members: true },
      });

      // por segurança (não deve acontecer porque já validámos)
      if (!updated) throw new NotFoundException('Team not found');

      return updated;
    });
  }

  /**
   * Remove um utilizador de uma equipa (disconnect).
   *
   * @param id ID da equipa
   * @param userId ID do utilizador
   * @returns Equipa com `members` atualizados
   * @throws NotFoundException Se a equipa não existir
   */
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

  /**
   * Atualiza uma equipa.
   *
   * ## Comportamento de membros
   * Se `dto.memberIds` vier definido, faz um reset completo:
   * `members.set = [...]`
   *
   * @param id ID da equipa
   * @param dto Campos a atualizar
   * @returns Equipa atualizada com `members` + `_count`
   * @throws NotFoundException Se a equipa não existir
   */
  async update(id: string, dto: UpdateTeamDto) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException('Team not found');

    const data: any = {};

    if (dto.name !== undefined) data.name = dto.name;

    if (dto.memberIds) {
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

  /**
   * Apaga uma equipa.
   *
   * @param id ID da equipa
   * @returns `{ deleted: true }`
   * @throws NotFoundException Se a equipa não existir
   */
  async remove(id: string) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException('Team not found');

    await this.prisma.team.delete({ where: { id } });
    return { deleted: true };
  }
}
