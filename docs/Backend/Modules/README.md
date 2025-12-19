# Backend Docs — Modules (README)

Esta pasta contém a documentação por **módulo** do backend (NestJS + Prisma).
O objetivo é manter docs **curtas**, **exatas** e alinhadas com o código e testes.

---

## Como navegar

1) Começa pela visão geral e bootstrap:
- `APP.md` — módulo base (AppModule, main.ts, CORS, pipes, tracing).

2) Depois segue pelo fluxo típico de uso da API:
- `AUTH.md` — autenticação, tokens, guards e regras de acesso.
- `USERS.md` — criação/consulta e operações de utilizadores.
- `TEAMS.md` — equipas, membros, regra “1 user = 1 team” (quando aplicável).
- `SERVICES.md` — catálogo/listagem de serviços.
- `INCIDENTS.md` — domínio principal (CRUD, status, severidade, timeline, comentários).
- `REPORTS.md` — KPIs, breakdown, timeseries e exports CSV/PDF.
- `NOTIFICATIONS.md` — integrações e disparos (se existirem endpoints/lógica interna).
- `AUDIT.md` — integridade/audit hash e regras de bloqueio (ex.: export PDF).
- `HEALTH.md` — health checks.
- `PRISMA.md` — PrismaModule/PrismaService, migrations/seeds e notas de DB.

---

## Conteúdo por ficheiro (o que esperar)

Cada `*.md` de módulo segue, idealmente, esta estrutura:

- **Responsabilidade única** (o que o módulo faz e o que *não* faz)
- **Endpoints** (paths, query/body DTOs, exemplos)
- **Autorização e scoping** (USER vs ADMIN, regras por team, etc.)
- **Validações** (DTOs `class-validator`, defaults, normalizações)
- **Erros** (400/401/403/404/409) e mensagens relevantes
- **Performance** (queries pesadas, paginação, caps/limits, índices esperados)
- **Testabilidade** (unit/e2e: o que deve estar coberto)

---

## Convenções

### Naming
- Um ficheiro por módulo: `AUTH.md`, `TEAMS.md`, etc.
- Títulos em formato: `# <Módulo> — Documentação`

### Exemplos de requests
- Preferir exemplos com `curl` (ou HTTP raw) e payloads mínimos.
- Sempre que a rota use `setGlobalPrefix('api')`, documentar como `/api/...`.

### Erros e status codes
- Quando o código lança `NotFoundException`, documentar como `404`.
- `ForbiddenException` → `403` (scoping, role, sem team, etc.)
- `ConflictException` → `409` (ex.: audit mismatch)
- `BadRequestException` → `400` (validação, password inválida, etc.)

---

## Checklist rápido para manter “profissional”

- [ ] O endpoint descrito existe no controller (path e HTTP verb corretos)
- [ ] O DTO descrito bate certo com os decorators (`IsString`, `IsOptional`, etc.)
- [ ] O comportamento de auth/scoping está alinhado com o service
- [ ] O doc menciona limites (ex.: cap 200 no PDF, limit 10k no CSV)
- [ ] Há exemplos de requests/responses reais e curtos

---

## Índice de ficheiros

- `APP.md`
- `AUTH.md`
- `USERS.md`
- `TEAMS.md`
- `SERVICES.md`
- `INCIDENTS.md`
- `REPORTS.md`
- `NOTIFICATIONS.md`
- `AUDIT.md`
- `HEALTH.md`
- `PRISMA.md`
