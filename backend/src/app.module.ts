// src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { IncidentsModule } from './incidents/incidents.module';
import { TeamsModule } from './teams/teams.module';
import { ServicesModule } from './services/services.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';

/**
 * AppModule
 *
 * Responsabilidade:
 * - Módulo raiz (root module) da aplicação NestJS.
 * - Agrega todos os módulos de domínio (auth/users/incidents/teams/etc.).
 *
 * Porque existe:
 * - É o entrypoint de DI (Dependency Injection) do Nest.
 * - Define controllers e providers globais do "core" da app.
 *
 * Dependências (imports):
 * - PrismaModule: DB access (PrismaService global, se @Global no PrismaModule).
 * - HealthModule: endpoints de health (ex.: /health).
 * - Auth/Users: autenticação e gestão de utilizadores.
 * - Incidents/Teams/Services: domínio principal da app.
 * - Notifications: integrações externas (Discord/PagerDuty/...).
 * - Reports: KPIs, breakdowns, exports CSV/PDF.
 */
@Module({
  imports: [
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    IncidentsModule,
    TeamsModule,
    ServicesModule,
    NotificationsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
