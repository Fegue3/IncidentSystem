/**
 * @file jest.e2e.config.ts
 * @module test/config/jest.e2e.config
 *
 * @summary
 *  - Configuração Jest para testes End-to-End (E2E) do backend.
 *
 * @description
 *  Esta configuração executa testes E2E localizados em `test/e2e/` (ficheiros `*.e2e.spec.ts`).
 *  O objetivo é validar o sistema “de ponta a ponta”: HTTP + pipes/validation + guards + módulos Nest +
 *  persistência (DB) + serialização das respostas.
 *
 *  Responsabilidades:
 *  - Selecionar apenas specs E2E (`testMatch`).
 *  - Definir timeout mais alto por envolver I/O (DB, HTTP, bootstrap da app).
 *  - Forçar execução sequencial (`maxWorkers: 1`) para reduzir flakiness quando há recursos partilhados
 *    (ex.: base de dados, portas, estado global).
 *
 * @dependencies
 *  - ts-jest: transpila TypeScript em runtime para o Jest.
 *
 * @security
 *  - Os E2E normalmente exercitam autenticação e permissões (guards/roles) via HTTP.
 *    Esta config não aplica regras; apenas garante que os testes correm no ambiente Node.
 *
 * @errors
 *  - Timeouts: requests/seed/reset lentos podem causar falhas. Ajustar `testTimeout` ou otimizar setup.
 *
 * @performance
 *  - `maxWorkers: 1` torna os testes mais previsíveis, mas pode aumentar tempo total de execução.
 *
 * @example
 *  npx jest -c test/config/jest.e2e.config.ts
 *  npx jest -c test/config/jest.e2e.config.ts -t "GET /api/reports"
 */

import type { Config } from 'jest';

const config: Config = {
  /**
   * Extensões consideradas pelo Jest quando resolve imports de módulos.
   * Mantém consistência entre TS/JS nos testes e no código.
   */
  moduleFileExtensions: ['js', 'json', 'ts'],

  /**
   * Diretoria raiz usada pelo Jest para resolver paths como `<rootDir>`.
   * Aqui aponta para a raiz do projeto (dois níveis acima de `test/config/`).
   */
  rootDir: '../..',

  /**
   * Ambiente de execução: Node.js (não DOM).
   * Em NestJS backend, isto é o padrão.
   */
  testEnvironment: 'node',

  /**
   * Transpilação em runtime para TS/JS.
   * - `^.+\\.(t|j)s$` inclui `.ts`, `.js`, `.tsx`, `.jsx` (quando aplicável).
   */
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },

  /**
   * Seleção dos testes E2E.
   * Apenas ficheiros com sufixo `.e2e.spec.ts` dentro de `test/e2e/`.
   */
  testMatch: ['<rootDir>/test/e2e/**/*.e2e.spec.ts'],

  /**
   * Paths ignorados (dependencies e build output).
   */
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],

  /**
   * Execução sequencial para reduzir colisões (DB/portas/estado global).
   */
  maxWorkers: 1,

  /**
   * Timeout por teste (ms).
   * E2E envolve bootstrap da aplicação e I/O, por isso é mais alto.
   */
  testTimeout: 60000,
};

export default config;
