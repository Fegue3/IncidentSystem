import { Body, Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { DatadogService } from '../webhooks/datadog.service';

@Controller('webhooks')
export class DatadogWebhookController {
  constructor(private readonly datadog: DatadogService) {}

  @Post('datadog')
  @HttpCode(200)
  async handle(@Body() body: any, @Headers() headers: Record<string, string>) {
    if (process.env.DD_WEBHOOK_TOKEN) {
      const token = headers['x-ims-token'] ?? headers['x-dd-token'];
      if (token !== process.env.DD_WEBHOOK_TOKEN) {
        throw new UnauthorizedException('Invalid webhook token');
      }
    }

    await this.datadog.ingestAlert(body);
    return { ok: true };
  }
}
