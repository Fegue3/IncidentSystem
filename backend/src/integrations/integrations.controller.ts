import { BadRequestException, Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { IntegrationKind } from '@prisma/client';
import { AccessJwtGuard } from '../auth/guards/access-jwt.guard';
import { IntegrationsService } from './integrations.service';
import { UpdateIntegrationDto } from './dto/update-integration.dto';

type ReqUser = { sub: string };

function parseId(id: string): IntegrationKind {
  const s = id.trim().toLowerCase();
  if (s === 'datadog') return IntegrationKind.DATADOG;
  if (s === 'pagerduty') return IntegrationKind.PAGERDUTY;
  if (s === 'discord') return IntegrationKind.DISCORD; // ✅ NEW
  throw new BadRequestException('Invalid integration id');
}

@Controller('integrations')
@UseGuards(AccessJwtGuard)
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get('settings')
  getMine(@Req() req: { user: ReqUser }) {
    return this.integrations.getForUser(req.user.sub);
  }

  @Patch('settings/:id')
  updateMine(
    @Req() req: { user: ReqUser },
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationDto,
  ) {
    const kind = parseId(id);
    return this.integrations.setEnabledForUser(req.user.sub, kind, dto.notificationsEnabled);
  }
}
