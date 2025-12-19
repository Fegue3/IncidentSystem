/**
 * @file jest.int.config.ts
 * @module test/config/jest.int.config
 *
 * @summary
 *  - Configuração Jest para testes de Integração (Integration) do backend.
 *
 * @description
 *  Esta configuração executa testes em `test/integration/`, tipicamente com DB real e módulos reais,
 *  mas sem necessariamente passar por HTTP (depende da suite).
 *
 *  Responsabilidades:
 *  - Selecionar specs de integração (`testMatch`).
 *  - Garantir execução previsível com `maxWorkers: 1` (útil quando há DB partilhada).
 *  - Gerar coverage separada em `coverage-integration/` para distinguir do coverage de unit.
 *
 * @dependencies
 *  - ts-jest: transpila TypeScript em runtime para o Jest.
 *
 * @security
 *  - Integração pode validar regras de scoping/permissões ao nível de services/repositories.
 *    Esta config não define auth; depende do código testado.
 *
 * @errors
 *  - Timeouts frequentes em reset/seed/queries pesadas. Ajustar `testTimeout` ou otimizar helpers.
 *
 * @performance
 *  - `maxWorkers: 1` reduz flakiness com DB partilhada; pode aumentar o tempo total.
 *  - Coverage em integração tende a ser mais caro — usar como diagnóstico, não como “métrica final”.
 *
 * @example
 *  npx jest -c test/config/jest.int.config.ts
 *  npx jest -c test/config/jest.int.config.ts test/integration/reports.int.spec.ts
 */

import type { Config } from 'jest';

const config: Config = {
  /**
   * Extensões consideradas pelo Jest quando resolve imports.
   */
  moduleFileExtensions: ['js', 'json', 'ts'],

  /**
   * Raiz do projeto (dois níveis acima de `test/config/`).
   */
  rootDir: '../..',

  /**
   * Ambiente Node.js.
   */
  testEnvironment: 'node',

  /**
   * Transpilação TS/JS em runtime.
   */
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },

  /**
   * Seleciona todos os specs em `test/integration/` que terminem em `.spec.ts`.
   * Nota: isto inclui nomes como `*.int.spec.ts` (também terminam em `.spec.ts`).
   */
  testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],

  /**
   * Ignora dependências e build output.
   */
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],

  /**
   * Execução sequencial para evitar conflitos de estado (DB/fixtures).
   */
  maxWorkers: 1,

  /**
   * Ficheiros alvo para coverage (TS/JS) — apenas `src/`.
   * Útil para perceber que caminhos do domínio são exercitados pelos testes de integração.
   */
  collectCoverageFrom: ['<rootDir>/src/**/*.(t|j)s'],

  /**
   * Diretoria de output do coverage de integração (separada das restantes).
   */
  coverageDirectory: '<rootDir>/coverage-integration',

  /**
   * Timeout por teste (ms). Integração normalmente é mais rápida que E2E.
   */
  testTimeout: 30000,
};

export default config;
