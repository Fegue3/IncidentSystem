// src/main.ts
import tracer from 'dd-trace';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * main.ts (bootstrap)
 *
 * Responsabilidade:
 * - Inicializar instrumentação (Datadog APM).
 * - Criar a app NestJS e configurar "cross-cutting concerns":
 *   - global prefix (/api)
 *   - CORS
 *   - ValidationPipe (whitelist)
 * - Subir o servidor HTTP (listen).
 *
 * Porque existe:
 * - É o entrypoint real do runtime (node) e define side-effects de arranque.
 *
 * Segurança / validação:
 * - ValidationPipe({ whitelist: true }) remove propriedades extra não declaradas em DTOs.
 *
 * CORS:
 * - Configurado para permitir requests do frontend em http://localhost:5173
 * - Inclui OPTIONS para preflight e Authorization header.
 *
 * Datadog:
 * - dd-trace deve iniciar ANTES de carregar módulos do framework para auto-instrumentação.
 *
 * ENV usadas:
 * - DD_TRACE_SAMPLE_RATE: número (default 1)
 * - DD_SERVICE: nome do serviço (default 'es-backend')
 * - DD_ENV / NODE_ENV: ambiente (default 'development')
 * - DD_VERSION: versão do serviço (opcional)
 * - PORT: porta HTTP (default 3000)
 */
const ddSampleRate = process.env.DD_TRACE_SAMPLE_RATE
  ? Number(process.env.DD_TRACE_SAMPLE_RATE)
  : 1;

// Start Datadog tracing before any framework modules load
tracer.init({
  service: process.env.DD_SERVICE || 'es-backend',
  env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
  version: process.env.DD_VERSION,
  logInjection: true,
  runtimeMetrics: true,
  sampleRate: Number.isNaN(ddSampleRate) ? 1 : ddSampleRate,
});

async function bootstrap() {
  /**
   * Cria a aplicação Nest a partir do AppModule (root module).
   */
  const app = await NestFactory.create(AppModule);

  /**
   * Prefixo global: todas as rotas passam a ser /api/...
   * Ex.: /auth/register -> /api/auth/register
   */
  app.setGlobalPrefix('api');

  /**
   * CORS:
   * - Necessário para o frontend comunicar com a API em dev (origens diferentes).
   * - "origin" deve bater com a origem real do frontend (porta incluída).
   *
   * Nota:
   * - Se estiveres a ter erro de CORS com outra origem (ex.: :5174),
   *   tens de ajustar a origin (ou permitir múltiplas origins).
   */
  app.enableCors({
    origin: 'http://localhost:5173',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
  });

  /**
   * Validação global:
   * - whitelist: remove campos extra do body/query/params que não existam no DTO.
   *
   * Sugestão (opcional):
   * - Para bloquear campos extra em vez de remover:
   *   new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
   */
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  /**
   * Porta:
   * - Usa PORT se existir, caso contrário 3000.
   */
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}

bootstrap();
