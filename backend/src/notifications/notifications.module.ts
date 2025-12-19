// src/notifications/notifications.module.ts

import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

/**
 * @file src/notifications/notifications.module.ts
 * @module Backend.Notifications
 *
 * @summary
 * Módulo NestJS que expõe o NotificationsService para o resto da aplicação.
 *
 * @description
 * Este módulo encapsula o serviço de integrações externas de notificação
 * (Discord / PagerDuty) e exporta-o para ser injetado noutros módulos
 * (ex.: Incidents).
 */
@Module({
  /**
   * Providers registados neste módulo.
   */
  providers: [NotificationsService],

  /**
   * Exports para permitir que outros módulos (que importem NotificationsModule)
   * consigam injetar NotificationsService.
   */
  exports: [NotificationsService],
})
export class NotificationsModule {}
