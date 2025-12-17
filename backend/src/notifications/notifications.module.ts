import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { IntegrationsModule } from '../integrations/integrations.module';
@Module({
  imports: [IntegrationsModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule { }
