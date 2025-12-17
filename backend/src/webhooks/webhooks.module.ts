import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DatadogWebhookController } from './datadog.controller';
import { DatadogService } from './datadog.service';

@Module({
  imports: [PrismaModule],
  controllers: [DatadogWebhookController],
  providers: [DatadogService],
})
export class WebhooksModule {}
