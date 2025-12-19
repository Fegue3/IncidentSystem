/**
 * @file backend/prisma/seed.runner.ts
 * @module Backend.Persistence.Seed.Runner
 *
 * @summary
 *  - Orquestra a execução das seeds Prisma na ordem correta.
 *
 * @description
 *  Este runner existe para padronizar o bootstrap de dados locais/dev:
 *   1) seed.ts           -> catálogos base + personas
 *   2) seed.incidents.ts -> dataset realista de incidentes
 *
 *  A execução é síncrona e falha-fast:
 *   - se algum comando retornar status != 0, o processo termina com esse código.
 *
 * @notes
 *  - Usa `spawnSync` com `stdio: "inherit"` para logs completos no terminal.
 *  - Assume que `ts-node` está disponível (dev), via `npx ts-node ...`.
 */

import { spawnSync } from "node:child_process";

/**
 * Executa um comando shell e termina o processo se falhar.
 * @param cmd comando a executar (string shell)
 */
function run(cmd: string) {
  const r = spawnSync(cmd, { stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// Ordem correta: base -> incidents
run("npx ts-node prisma/seed.ts");
run("npx ts-node prisma/seed.incidents.ts");
