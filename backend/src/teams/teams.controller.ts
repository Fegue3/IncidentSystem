// src/teams/teams.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { ListTeamsDto } from './dto/list-teams.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { AccessJwtGuard } from '../auth/guards/access-jwt.guard';

/**
 * Controller REST para operações sobre equipas (Teams).
 *
 * ## Base route
 * `/teams`
 *
 * ## Segurança
 * Todas as rotas estão protegidas por `AccessJwtGuard`.
 * Assume-se que `req.user` contém um identificador em `sub` ou `id`.
 *
 * ## Responsabilidades
 * - Expor endpoints CRUD de equipas.
 * - Expor endpoints para gestão de membros.
 * - Delegar toda a lógica de negócio para `TeamsService`.
 */
@UseGuards(AccessJwtGuard)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  // --------- CRUD principal ---------

  /**
   * Cria uma equipa.
   *
   * @route POST /teams
   * @param dto Dados de criação (nome obrigatório, membros opcionais).
   * @returns Equipa criada com `_count` (members/incidents).
   *
   * @throws NotFoundException Indiretamente (se IDs ligados não existirem e o Prisma falhar).
   * @throws Prisma errors Em caso de constraint/ligação inválida.
   */
  @Post()
  create(@Body() dto: CreateTeamDto) {
    return this.teamsService.create(dto);
  }

  /**
   * Lista equipas com filtro opcional por nome.
   *
   * @route GET /teams?search=...
   * @param query Query params validados por `ListTeamsDto`.
   * @returns Lista de equipas ordenadas por nome (asc) com `_count`.
   */
  @Get()
  findAll(@Query() query: ListTeamsDto) {
    return this.teamsService.findAll(query);
  }

  /**
   * Lista equipas em que o utilizador autenticado é membro.
   *
   * @route GET /teams/me
   * @param req Request com `user.sub` ou `user.id`.
   * @returns Lista de equipas do utilizador (ordenadas por nome) com `_count`.
   */
  @Get('me')
  findMine(@Req() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.teamsService.findForUser(userId);
  }

  /**
   * Obtém uma equipa por ID (inclui membros).
   *
   * @route GET /teams/:id
   * @param id ID da equipa
   * @returns Equipa com `members` + `_count`
   *
   * @throws NotFoundException Se a equipa não existir.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teamsService.findOne(id);
  }

  /**
   * Atualiza uma equipa.
   *
   * @route PATCH /teams/:id
   * @param id ID da equipa
   * @param dto Campos a atualizar. Se `memberIds` vier, faz reset de membros.
   * @returns Equipa atualizada com `members` + `_count`
   *
   * @throws NotFoundException Se a equipa não existir.
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teamsService.update(id, dto);
  }

  /**
   * Remove uma equipa.
   *
   * @route DELETE /teams/:id
   * @param id ID da equipa
   * @returns `{ deleted: true }`
   *
   * @throws NotFoundException Se a equipa não existir.
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.teamsService.remove(id);
  }

  // --------- Membros ---------

  /**
   * Lista os membros de uma equipa.
   *
   * @route GET /teams/:id/members
   * @param id ID da equipa
   * @returns Lista de utilizadores membros
   *
   * @throws NotFoundException Se a equipa não existir.
   */
  @Get(':id/members')
  listMembers(@Param('id') id: string) {
    return this.teamsService.listMembers(id);
  }

  /**
   * Adiciona um membro à equipa.
   *
   * ## Regra de negócio
   * Um user só pode estar em **1 equipa**:
   * - remove o user de todas as outras equipas
   * - adiciona à equipa alvo
   *
   * @route POST /teams/:id/members
   * @param id ID da equipa alvo
   * @param dto `{ userId }`
   * @returns Equipa alvo com `members` atualizados
   *
   * @throws NotFoundException Se equipa ou user não existirem.
   */
  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.teamsService.addMember(id, dto.userId);
  }

  /**
   * Remove um membro de uma equipa.
   *
   * @route DELETE /teams/:id/members/:userId
   * @param id ID da equipa
   * @param userId ID do utilizador
   * @returns Equipa com `members` atualizados
   *
   * @throws NotFoundException Se a equipa não existir.
   */
  @Delete(':id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.teamsService.removeMember(id, userId);
  }
}
