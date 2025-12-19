/**
 * @file jest.unit.config.ts
 * @module test/config/jest.unit.config
 *
 * @summary
 *  - Configuração Jest para testes Unitários (Unit) do backend.
 *
 * @description
 *  Esta configuração executa testes unitários em `test/unit/`, focados em lógica isolada.
 *  Em unit tests, dependências externas devem ser mockadas (ex.: PrismaService, gateways, HTTP).
 *
 *  Responsabilidades:
 *  - Selecionar specs unitários via regex (`testRegex`).
 *  - Produzir coverage unitário em `coverage/unit/`.
 *  - Garantir isolamento por defeito com `clearMocks: true`.
 *
 * @dependencies
 *  - ts-jest: transpila TypeScript em runtime para o Jest.
 *
 * @security
 *  - Unit tests validam regras localmente (ex.: guards/helpers/validações) sem depender do ambiente.
 *
 * @errors
 *  - Falhas comuns: mocks incompletos, dependência inadvertida de I/O, ou “estado global” não limpo.
 *
 * @performance
 *  - Unit deve ser rápido. Se ficar lento, há risco de estar a tocar DB/rede por engano.
 *
 * @example
 *  npx jest -c test/config/jest.unit.config.ts
 *  npx jest -c test/config/jest.unit.config.ts test/unit/auth.service.spec.ts
 */

import type { Config } from 'jest';

const config: Config = {
  /**
   * Extensões consideradas pelo Jest quando resolve imports.
   */
  moduleFileExtensions: ['js', 'json', 'ts'],

  /**
   * Aqui `rootDir` está definido como `..` porque este ficheiro vive em `backend/test/config/`.
   * Ou seja, `<rootDir>` passa a ser `backend/test`.
   */
  rootDir: '..', // /backend/test

  /**
   * Seleciona specs unitários dentro de `unit/` que terminem em `.spec.ts`.
   * Usar regex torna explícito que unit tests vivem sob `test/unit/`.
   */
  testRegex: 'unit/.*\\.spec\\.ts$',

  /**
   * Transpilação TS/JS em runtime.
   */
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },

  /**
   * Coverage do código de produção (src), excluindo `main.ts` (bootstrap).
   */
  collectCoverageFrom: ['../src/**/*.ts', '!../src/main.ts'],

  /**
   * Diretoria de output do coverage unitário.
   */
  coverageDirectory: '../coverage/unit',

  /**
   * Ambiente Node.js.
   */
  testEnvironment: 'node',

  /**
   * Limpa mocks entre testes automaticamente:
   * reduz dependência de ordem e estado partilhado.
   */
  clearMocks: true,
};

export default config;
