// prisma/seed.runner.ts
import { spawnSync } from "node:child_process";

function run(cmd: string) {
    const r = spawnSync(cmd, { stdio: "inherit", shell: true });
    if (r.status !== 0) process.exit(r.status ?? 1);
}

run("npx ts-node prisma/seed.ts");
run("npx ts-node prisma/seed.incidents.ts");
