// src/app.service.ts
import { Injectable } from '@nestjs/common';

/**
 * AppService
 *
 * Responsabilidade:
 * - Lógica mínima para o endpoint base (GET /).
 *
 * Porque existe:
 * - Mantém o controller "magro" e consistente com o padrão Nest (controller -> service).
 *
 * Nota:
 * - Em apps reais, este service pode nem existir; aqui serve como exemplo e "hello route".
 */
@Injectable()
export class AppService {
  /**
   * Mensagem simples usada no endpoint GET /.
   *
   * @returns string
   */
  getHello(): string {
    return 'Hello World!';
  }
}
