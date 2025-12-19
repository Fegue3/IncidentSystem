// src/app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * AppController
 *
 * Responsabilidade:
 * - Expor um endpoint base (GET /) para confirmar que a API está up e a responder.
 *
 * Contexto:
 * - Útil como "smoke test" rápido em dev/CI/health checks simples.
 * - Para health checks completos, usa o HealthModule (se existir).
 *
 * Rotas:
 * - GET / -> devolve uma string (ex.: "Hello World!")
 *
 * Notas:
 * - Não usa auth nem validação porque não recebe input.
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * GET /
   *
   * @returns string Mensagem estática vinda do AppService.
   */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
