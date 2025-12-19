// src/incidents/incidents.controller.ts

/**
 * @file src/incidents/incidents.controller.ts
 * @module Backend.Incidents.Controller
 *
 * @summary
 * Controller HTTP para gestão de incidentes.
 *
 * @description
 * Todos os endpoints estão protegidos por `AccessJwtGuard` (JWT Bearer).
 * O userId é obtido de `req.user.sub` (payload JWT) com fallback para `req.user.id`.
 *
 * @base_route
 * /incidents
 *
 * @guards
 * - AccessJwtGuard (aplicado ao controller inteiro)
 *
 * @endpoints
 * - POST   /incidents                 -> create
 * - GET    /incidents                 -> findAll (filtros via query)
 * - GET    /incidents/:id             -> findOne
 * - PATCH  /incidents/:id             -> update
 * - PATCH  /incidents/:id/status      -> changeStatus
 * - POST   /incidents/:id/comments    -> addComment
 * - GET    /incidents/:id/comments    -> listComments
 * - GET    /incidents/:id/timeline    -> listTimeline
 * - POST   /incidents/:id/subscribe   -> subscribe
 * - DELETE /incidents/:id/subscribe   -> unsubscribe
 * - DELETE /incidents/:id             -> remove (delete)
 */

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
} from "@nestjs/common";
import { IncidentsService } from "./incidents.service";
import { CreateIncidentDto } from "./dto/create-incident.dto";
import { UpdateIncidentDto } from "./dto/update-incident.dto";
import { ChangeStatusDto } from "./dto/change-status.dto";
import { AddCommentDto } from "./dto/add-comment.dto";
import { ListIncidentsDto } from "./dto/list-incidents.dto";
import { AccessJwtGuard } from "../auth/guards/access-jwt.guard";

@UseGuards(AccessJwtGuard)
@Controller("incidents")
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  /**
   * POST /incidents
   * Cria um incidente e regista reporter a partir do JWT.
   */
  @Post()
  create(@Body() dto: CreateIncidentDto, @Req() req) {
    const userId = req.user.sub || req.user.id;
    return this.incidentsService.create(dto, userId);
  }

  /**
   * GET /incidents
   * Lista incidentes com filtros opcionais via query params.
   */
  @Get()
  findAll(@Query() query: ListIncidentsDto) {
    return this.incidentsService.findAll(query);
  }

  /**
   * GET /incidents/:id
   * Devolve o incidente com includes (reporter/assignee/team/service/categories/tags/capas/comments/timeline/sources).
   */
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.incidentsService.findOne(id);
  }

  /**
   * PATCH /incidents/:id
   * Atualiza campos do incidente e regista eventos na timeline.
   */
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateIncidentDto, @Req() req) {
    const userId = req.user.sub || req.user.id;
    return this.incidentsService.update(id, dto, userId);
  }

  /**
   * PATCH /incidents/:id/status
   * Muda status do incidente, validando transição, e regista evento de STATUS_CHANGE.
   */
  @Patch(":id/status")
  changeStatus(@Param("id") id: string, @Body() dto: ChangeStatusDto, @Req() req) {
    const userId = req.user.sub || req.user.id;
    return this.incidentsService.changeStatus(id, dto, userId);
  }

  /**
   * POST /incidents/:id/comments
   * Adiciona comentário e regista evento COMMENT na timeline.
   */
  @Post(":id/comments")
  addComment(@Param("id") id: string, @Body() dto: AddCommentDto, @Req() req) {
    const userId = req.user.sub || req.user.id;
    return this.incidentsService.addComment(id, dto, userId);
  }

  /**
   * GET /incidents/:id/comments
   * Lista comentários do incidente.
   */
  @Get(":id/comments")
  listComments(@Param("id") id: string) {
    return this.incidentsService.listComments(id);
  }

  /**
   * GET /incidents/:id/timeline
   * Lista eventos da timeline do incidente.
   */
  @Get(":id/timeline")
  listTimeline(@Param("id") id: string) {
    return this.incidentsService.listTimeline(id);
  }

  /**
   * POST /incidents/:id/subscribe
   * Cria subscrição para notificações relacionadas com o incidente.
   */
  @Post(":id/subscribe")
  subscribe(@Param("id") id: string, @Req() req) {
    const userId = req.user.sub || req.user.id;
    return this.incidentsService.subscribe(id, userId);
  }

  /**
   * DELETE /incidents/:id/subscribe
   * Remove subscrição do utilizador para o incidente.
   */
  @Delete(":id/subscribe")
  unsubscribe(@Param("id") id: string, @Req() req) {
    const userId = req.user.sub || req.user.id;
    return this.incidentsService.unsubscribe(id, userId);
  }

  /**
   * DELETE /incidents/:id
   * Apaga o incidente (regra: apenas reporter pode apagar).
   */
  @Delete(":id")
  remove(@Param("id") id: string, @Req() req) {
    const userId = req.user.sub || req.user.id;
    return this.incidentsService.delete(id, userId);
  }
}
