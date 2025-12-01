// src/incidents/incidents.controller.ts
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
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { ListIncidentsDto } from './dto/list-incidents.dto';
import { AccessJwtGuard } from '../auth/guards/access-jwt.guard';

@UseGuards(AccessJwtGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  create(@Body() dto: CreateIncidentDto, @Req() req) {
    const userId = req.user.sub || req.user.id;
    return this.incidentsService.create(dto, userId);
  }

  @Get()
  findAll(@Query() query: ListIncidentsDto) {
    return this.incidentsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.incidentsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
    @Req() req,
  ) {
    const userId = req.user.sub || req.user.id;
    return this.incidentsService.update(id, dto, userId);
  }

  @Patch(':id/status')
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @Req() req,
  ) {
    const userId = req.user.sub || req.user.id;
    return this.incidentsService.changeStatus(id, dto, userId);
  }

  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
    @Req() req,
  ) {
    const userId = req.user.sub || req.user.id;
    return this.incidentsService.addComment(id, dto, userId);
  }

  @Get(':id/comments')
  listComments(@Param('id') id: string) {
    return this.incidentsService.listComments(id);
  }

  @Get(':id/timeline')
  listTimeline(@Param('id') id: string) {
    return this.incidentsService.listTimeline(id);
  }

  @Post(':id/subscribe')
  subscribe(@Param('id') id: string, @Req() req) {
    const userId = req.user.sub || req.user.id;
    return this.incidentsService.subscribe(id, userId);
  }

  @Delete(':id/subscribe')
  unsubscribe(@Param('id') id: string, @Req() req) {
    const userId = req.user.sub || req.user.id;
    return this.incidentsService.unsubscribe(id, userId);
  }
}
