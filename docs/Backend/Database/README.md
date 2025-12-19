# Database (PostgreSQL + Prisma) — README

Esta pasta descreve e versiona a camada de persistência do **IMS (Incident Management System)**.  
O **source of truth** do modelo de dados é o `schema.prisma`; todas as alterações à base de dados devem acontecer via **migrations** (nunca “à mão” na DB).

---

## Estrutura recomendada desta pasta

Dentro de `backend/prisma/` (ou `docs/Backend/Database/` se estiveres a guardar só documentação), a estrutura típica e “profissional” fica assim:

- `schema.prisma`
  - Modelo de dados (enums, models, relações, constraints e índices).
- `migrations/`
  - Historial versionado das migrations do Prisma (cada pasta = 1 migração).
- `migration_lock.toml`
  - Lockfile do Prisma para migrations (não editar manualmente).
- `seed.ts` / `seed.runner.ts` / `seed.incidents.ts` 
  - Seeds para dados base e dataset realista.

---

## Documentação incluída (este pacote de 4 ficheiros)

Este README “amarra” os 4 documentos que já criaste:

1) **`DATABASE-STRUCTURE.md`**
- Visão de alto nível do modelo (entidades core, relações e racional).
- Ótimo para onboarding (sem mergulhar logo em Prisma).

2) **`SCHEMA.md`**
- Documentação do `schema.prisma` (detalhe técnico: enums, constraints, índices e garantias de integridade).
- É o documento que mais deve acompanhar o código.

3) **`MIGRATIONS.md`**
- Como funciona o workflow de migrations no projeto e o “changelog” das migrations existentes.
- Inclui padrões, regras e o que cada migração introduziu/alterou.

4) **`SEED-LOGIC.md`**
- Como os seeds estão organizados (ordem de execução, variáveis de ambiente, reset e idempotência).
- Essencial para testes/e2e e para gerar datasets grandes (ex.: incidentes + timeline + comments).

> Sugestão de leitura: `DATABASE-STRUCTURE.md` → `SCHEMA.md` → `MIGRATIONS.md` → `SEED-LOGIC.md`.

---

## Regras do projeto (as “leis” da DB)

- **Schema é verdade**: qualquer mudança estrutural começa no `schema.prisma`.
- **Sem alterações manuais** em produção/dev DB (tudo via migrations).
- **Nunca reescrever migrations aplicadas** (cria uma nova migração).
- **Mudanças que impactam relatórios** (filters, groupBy, timeseries) devem considerar **índices** e **custos de query**.
- **Mudanças em enums** exigem alinhamento com o backend TS (DTOs, services, seed e testes).

---

## Quickstart local (DB + Prisma)

### 1) Variáveis de ambiente
Precisas de `DATABASE_URL` apontar para Postgres.

Exemplo:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/incidentdb?schema=public
```

### 2) Subir Postgres (via Docker) *(recomendado)*
```bash
docker compose up -d db
```

### 3) Gerar Prisma Client
```bash
cd backend
npx prisma generate
```

### 4) Aplicar migrations (dev)
```bash
npx prisma migrate dev
```

### 5) Seeds (opcional, mas recomendado)
```bash
npm run seed
# ou: node/ts-node do seed.runner conforme o teu projeto
```

### 6) Inspecionar dados
```bash
npx prisma studio
```

---

## Workflow de evolução do schema (padrão “limpo”)

Quando precisas de mudar a DB:

1) Edita `schema.prisma`
2) Cria migration:
```bash
npx prisma migrate dev --name <nome_curto_e_claro>
```
3) Confirma que:
- a migration gerada faz sentido (SQL)
- testes passam
- seeds ainda funcionam (ou atualiza-os)
4) Atualiza docs:
- `SCHEMA.md` (mudança técnica)
- `DATABASE-STRUCTURE.md` (se mudou o domínio/relacionamentos)
- `MIGRATIONS.md` (adiciona entrada/changelog)
- `SEED-LOGIC.md` (se o seed mudou)

---

## Deploy (produção / ambientes CI)

Em ambientes “não-dev”, o fluxo esperado é:

```bash
npx prisma migrate deploy
npx prisma generate
```

> **Nota:** `migrate deploy` aplica migrations já geradas e committed no repo (não cria novas).

---

## Troubleshooting rápido

### “Drift” / Schema mismatch
- Se o Prisma detetar drift entre DB e migrations, valida:
  - se alguém mexeu na DB manualmente
  - se migrations foram alteradas depois de aplicadas

Em dev, a forma mais simples é (⚠️ apaga dados):
```bash
npx prisma migrate reset
```

### Unique constraint errors em seed/testes (`P2002`)
- Normalmente significa que o seed está a tentar criar algo “duplicado” (ex.: `Service.key`, `Team.name`, `User.email`).
- Solução típica:
  - usar prefixos (`SEED_PREFIX`) e/ou IDs de run
  - limpar/reset antes de semear (`SEED_RESET=1`)
  - garantir idempotência no runner

### Queries lentas em reports
- Confirma se os filtros usados estão cobertos por índices (ex.: `createdAt`, `teamId`, `primaryServiceId`, `severity`, `status`).
- Evita `take` grande sem paginação (CSV/PDF exports têm caps por motivos de performance).

---

## Checklist de qualidade (database)

- [ ] `schema.prisma` documentado e consistente com o domínio
- [ ] migrations pequenas, com nomes claros e sem reescrita histórica
- [ ] seeds determinísticos (ou controlados por env vars) para testes e demo
- [ ] índices alinhados com queries reais (incidents + reports)
- [ ] docs atualizados sempre que schema/migrations/seeds mudam

---

## Índice (links rápidos)

- `DATABASE-STRUCTURE.md`
- `SCHEMA.md`
- `MIGRATIONS.md`
- `SEED-LOGIC.md`
