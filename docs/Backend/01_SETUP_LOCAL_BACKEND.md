# Backend — Setup Local (NestJS + Prisma)

Este guia cobre **apenas o backend**: instalação, base de dados, Prisma, seeds, execução em dev e testes.

> O backend usa:
> - NestJS
> - Prisma (PostgreSQL)
> - dd-trace (Datadog tracing) inicializado no `main.ts`
> - Prefixo global de API: `/api` (via `app.setGlobalPrefix('api')`)

---

## 1) Pré-requisitos

### Obrigatórios
- **Node.js 18+** (inclui npm)
- **Docker** + **Docker Compose**
- **Git**

### Recomendados
- Cliente PostgreSQL (DBeaver/psql) para debug
- Extensões VSCode: Prisma, ESLint, Prettier

---

## 2) Estrutura esperada do projeto

Assume-se que existe uma pasta:

```txt
backend/
  package.json
  prisma/
  src/
```

E que o Prisma está configurado para usar uma DB Postgres local (normalmente via Docker).

---

## 3) Variáveis de ambiente (`backend/.env`)

1) Cria o `.env` a partir do template do projeto:

```bash
cp backend/.env.example backend/.env
```

2) Confirma no `backend/.env` pelo menos:

### Base de dados (Prisma)
- `DATABASE_URL=...`

> Exemplo típico (pode não ser o teu; segue o `.env.example`):
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/incidentdb?schema=public
```

### API
- `PORT=3000` (opcional; se não existir, cai para 3000)

### Auditoria/Integridade (Reports PDF)
- `AUDIT_HMAC_SECRET=...`  
  - Se não existir, o export PDF pode não conseguir validar/gerar audit hashes conforme o fluxo.

### Datadog tracing (dd-trace)
O `main.ts` lê estas variáveis:
- `DD_TRACE_SAMPLE_RATE` (default 1)
- `DD_SERVICE` (default `es-backend`)
- `DD_ENV` (default `NODE_ENV` ou `development`)
- `DD_VERSION` (opcional)

> Se não tiveres Datadog Agent local, normalmente não bloqueia o backend — mas pode gerar logs/overhead.  
> Se quiseres reduzir ruído, define:
```env
DD_TRACE_SAMPLE_RATE=0
```

---

## 4) Subir dependências com Docker (PostgreSQL, etc.)

A forma “normal” é correr o compose na **raiz do repo** (onde estiver o `docker-compose.yml`):

```bash
docker compose up -d --build
docker compose ps
```

Se o teu compose estiver noutra pasta (ex.: `infra/`), corre a partir daí.

> Objetivo: ter o PostgreSQL disponível antes de correr migrations.

---

## 5) Instalar dependências do backend

```bash
cd backend
npm ci
```

Se não tiveres `package-lock.json` (não recomendado), usa:

```bash
npm install
```

---

## 6) Prisma: generate + migrations

Dentro de `backend/`:

```bash
npx prisma generate
npx prisma migrate dev
```

Se o projeto tiver migrations iniciais nomeadas, podes usar:

```bash
npx prisma migrate dev --name init
```

### (Opcional) Seed de dados
Depende do teu `package.json`. Usa o script que existir:

```bash
npm run seed
```

Se não existir script, confirma qual é o entrypoint (ex.: `prisma/seed.ts`, `prisma/seed.runner.ts`) e cria um script no `package.json` tipo:

```json
{
  "scripts": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

> No teu projeto já existe lógica de seed mais avançada (ex.: incidents, timeline, comments). Faz sentido ter:
> - `seed` (base: users/teams/services/categories)
> - `seed:incidents` (dataset pesado)
> - `seed:all` (runner)

---

## 7) Correr o backend em desenvolvimento

O comando exato depende do teu `package.json`. Os mais comuns em Nest:

```bash
npm run start:dev
```

ou

```bash
npm run dev
```

Se não souberes qual é, abre `backend/package.json` e usa o script equivalente.

### Confirmar que está a responder
Como tens `app.setGlobalPrefix('api')`, os endpoints ficam com `/api/...`.

Exemplos típicos:
- `GET http://localhost:3000/api` (pelo teu `AppController`, devolve `"Hello World!"`)
- Health (depende do teu `HealthController`):
  - normalmente `GET http://localhost:3000/api/health`

Testar rápido:

```bash
curl http://localhost:3000/api
```

---

## 8) CORS (importante no teu projeto)

No teu `main.ts` o CORS está fixo para:

```ts
origin: 'http://localhost:5173'
```

✅ Isto significa:
- Frontend deve correr em **http://localhost:5173**
- Se o frontend correr noutra porta (ex.: 5174), vais levar erro de CORS.

### Como resolver quando dá mismatch (5173 vs 5174)
Opções:
1) **Forçar o frontend a usar 5173**
2) Trocar o CORS do backend para aceitar a porta correta
3) Melhor prática: usar env var:
   - `CORS_ORIGIN=http://localhost:5173`
   - e no `main.ts` ler essa var

---

## 9) Testes (unit / integration / e2e)

Os nomes dos scripts variam, mas o padrão costuma ser:

```bash
npm run test
npm run test:watch
npm run test:e2e
```

> Para **integration/e2e**, normalmente precisas do Postgres a correr + migrations aplicadas.  
> Boa prática: antes dos testes e2e, correr `prisma migrate` e garantir DB limpa (dependendo da tua estratégia).

---

## 10) Troubleshooting rápido

### Prisma não conecta / `DATABASE_URL` inválida
- Confirma se o Postgres está mesmo “UP”:
  ```bash
  docker compose ps
  ```
- Confirma a porta (5432 vs outra).
- Confirma o host: se for Docker, muitas vezes é `localhost` (dev local) ou o nome do serviço dentro do compose.

### Porta 3000 ocupada
- Muda `PORT` no `backend/.env`, ou liberta a porta.

### Export PDF falha com “Integrity check…”
- Confirma `AUDIT_HMAC_SECRET` definido.
- Confirma que os incidentes têm `auditHash` (ou que o sistema consegue gerar no momento).

### CORS bloqueia chamadas do frontend
- Confere a origem do browser (porta do Vite).
- Ajusta `origin` no `enableCors`.

---

## 11) Checklist final

✅ `backend/.env` criado e preenchido  
✅ Docker (Postgres) a correr  
✅ `npm ci` executado em `backend/`  
✅ `npx prisma generate` + `npx prisma migrate dev`  
✅ `npm run seed` (se aplicável)  
✅ backend a responder em `http://localhost:3000/api`

---
