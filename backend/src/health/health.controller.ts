/**
 * @file backend/src/health/health.controller.ts
 * @module Backend.Health.Controller
 *
 * @summary
 * Endpoint de health-check da aplicação (API + DB).
 *
 * @description
 * Expõe um endpoint HTTP simples para:
 * - confirmar que a API está a responder
 * - verificar conectividade à base de dados (PostgreSQL) via Prisma
 *
 * O check da DB é feito com um "ping" barato:
 * - `SELECT 1`
 *
 * Se a DB falhar, o endpoint não rebenta a request: devolve `status="degraded"`.
 *
 * @base_route
 * /health
 *
 * @endpoints
 * GET /health
 *  - 200 OK sempre que a API responde
 *  - `status`:
 *      - "ok" quando o ping à DB funciona
 *      - "degraded" quando o ping à DB falha
 *
 * @response
 * {
 *   status: "ok" | "degraded",
 *   checks: { db: boolean },
 *   uptime: number,        // segundos (arredondado)
 *   timestamp: string      // ISO date
 * }
 *
 * @dependencies
 * - PrismaService: usado para executar `$queryRaw` como ping da DB.
 *
 * @notes
 * - Mesmo em modo degraded, o HTTP status é 200 para facilitar health probes.
 *   Se quiseres comportamento mais "k8s-like", dá para mudar para 503 quando db=false.
 */

import { Controller, Get, HttpCode } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private prisma: PrismaService) {}

  /**
   * GET /health
   *
   * @returns payload de health com checks e metadata (uptime/timestamp)
   */
  @Get()
  @HttpCode(200)
  async health() {
    let db = true;

    try {
      // Ping simples à BD (Postgres) para validar conectividade.
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      // Se falhar, marcamos como degraded mas não lançamos exceção.
      db = false;
    }

    return {
      status: db ? "ok" : "degraded",
      checks: { db },
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
