import tracer from 'dd-trace';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

export function initTracing() {
  // em testes não queremos side-effects nem depender do dd-trace
  if (process.env.NODE_ENV === 'test') return;

  const ddSampleRate = process.env.DD_TRACE_SAMPLE_RATE
    ? Number(process.env.DD_TRACE_SAMPLE_RATE)
    : 1;

  tracer.init({
    service: process.env.DD_SERVICE || 'es-backend',
    env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
    version: process.env.DD_VERSION,
    logInjection: true,
    runtimeMetrics: true,
    sampleRate: Number.isNaN(ddSampleRate) ? 1 : ddSampleRate,
  });
}

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);

  return app;
}

// só corre automaticamente fora de testes
initTracing();
if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}
