# Backend — Configuração Local (Env, Ports, CORS, Prisma, Observabilidade)

Este documento descreve **toda a configuração** relevante do **backend** (NestJS + Prisma), com foco em **ambiente local**.  
Serve como referência para: `.env`, variáveis obrigatórias/opcionais, defaults no código, e como validar que está tudo OK.

> Nota: alguns valores dependem do teu `backend/.env.example` / `docker-compose.yml`. Onde eu não consigo garantir o valor exato, deixo indicado **“ver .env.example”**.

---

## 1) Onde a configuração vive

### 1.1 Ficheiros típicos
- `backend/.env` (local — **não commitar**)
- `backend/.env.example` (template para dev — **commitar**)
- `docker-compose.yml` (ports/serviços, pode injectar envs)
- `backend/src/main.ts` (defaults e configuração runtime: CORS, global prefix, pipes)
- `backend/prisma/schema.prisma` (datasource + generator)
- `backend/prisma/seed*.ts` (vars de seed / dataset)

### 1.2 Convenção recomendada
- Tudo o que é segredo (JWT secret, HMAC secret, tokens, etc.) fica em `.env`.
- Defaults seguros (ex.: `PORT=3000`) podem viver no código.
- Nunca depender de valores “mágicos” sem doc — se existe `process.env.X`, documenta em `docs/Backend/Config/`.

---

## 2) Variáveis de Ambiente (Env Vars)

### 2.1 Runtime / HTTP
Estas variáveis são lidas diretamente em `main.ts`:

- `PORT`
  - **Opcional**
  - Default no código: `3000`
  - Usada para `app.listen(...)`

- `NODE_ENV`
  - **Opcional**
  - Default no código: `'development'` (via fallback em `DD_ENV`, ver abaixo)
  - Usada indiretamente na observabilidade

### 2.2 CORS (Frontend ↔ Backend)
No teu `main.ts`, está hardcoded:

```ts
app.enableCors({
  origin: 'http://localhost:5173',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type, Authorization',
  credentials: true,
});
```

**Implicação importante:** se o frontend correr noutro porto (ex.: `5174`) vais levar erro de CORS (tu já apanhaste isso).

Opções profissionais (escolhe 1):

**A) Simples (dev):** permitir várias origens
- Ajusta para aceitar um array de origins
- Ou lê de env: `CORS_ORIGIN=http://localhost:5173,http://localhost:5174`

**B) “Dev safe”:** permitir qualquer origin em dev
- Só se `NODE_ENV=development`.
- Em produção, whitelist fixa.

> Recomendação: cria `CORS_ORIGIN` no `.env` e usa split por vírgula.

### 2.3 Prisma / Base de Dados
Normalmente o Prisma usa:
- `DATABASE_URL`
  - **Obrigatória** (para correr a app com DB real e para migrations/seed)
  - Ver `backend/.env.example` para o formato exato

Exemplo típico (ajusta ao teu compose):
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/incidentdb?schema=public
```

> Se estiveres a correr DB em Docker, confirma se o host é `localhost` (quando ligas do host) ou o nome do service (quando ligas a partir de outro container).

### 2.4 Auditoria / Integridade (PDF export)
No `ReportsService` há uso de:

- `AUDIT_HMAC_SECRET`
  - **Opcional**, mas recomendado
  - Se existir, o export PDF valida integridade com HMAC e pode **bloquear export** com `409 Conflict` se houver mismatch.

Exemplo:
```env
AUDIT_HMAC_SECRET=dev-secret-change-me
```

### 2.5 Datadog Tracing (dd-trace)
No `main.ts` (antes do bootstrap do Nest) tens:

- `DD_TRACE_SAMPLE_RATE`
  - **Opcional**
  - Default no código: `1` (100%)
  - Se for inválido, o código cai para `1`.

- `DD_SERVICE`
  - **Opcional**
  - Default: `'es-backend'`

- `DD_ENV`
  - **Opcional**
  - Default: `process.env.NODE_ENV || 'development'`

- `DD_VERSION`
  - **Opcional**
  - Sem default (fica `undefined`)

Se não estiveres a usar Datadog localmente, podes deixar isto como está — o tracer inicia na mesma, mas sem agent pode ser “no-op”/sem envio.

Exemplo dev:
```env
DD_TRACE_SAMPLE_RATE=1
DD_SERVICE=ims-backend
DD_ENV=development
DD_VERSION=dev
```

### 2.6 Seeds (dataset local)
Pelos teus scripts de seed (ex.: `seed.incidents.ts`), existem variáveis típicas como:
- `SEED_PREFIX`
- `SEED_COUNT`
- `SEED_BASE_DATE`
- `SEED_WINDOW_DAYS`
- `SEED_RESET`
- `SEED_RUN_ID`

**Nota:** estes nomes dependem do teu seed real, mas já vi estes no código que enviaste.

Exemplo dev:
```env
SEED_PREFIX=DevSeed:
SEED_COUNT=500
SEED_BASE_DATE=2025-12-15
SEED_WINDOW_DAYS=30
SEED_RESET=true
SEED_RUN_ID=local
```

---

## 3) Defaults importantes que já existem no código

- Prefixo global da API: `app.setGlobalPrefix('api')`
  - Portanto, controllers tipo `@Controller('auth')` ficam em `/api/auth/...`

- `ValidationPipe({ whitelist: true })`
  - Campos extra no body/query **são removidos** (não falha, apenas “limpa”).
  - Se quiseres modo mais estrito no futuro:
    - `forbidNonWhitelisted: true`
    - `transform: true`

---

## 4) Checklist de configuração (local)

### 4.1 O mínimo para “levantar” backend com DB
- ✅ `backend/.env` existe
- ✅ `DATABASE_URL` aponta para uma BD acessível
- ✅ Docker compose da BD está a correr (ou Postgres local)
- ✅ `npx prisma generate` executado (1ª vez ou após `schema.prisma` mudar)
- ✅ `npx prisma migrate dev` aplicado (se usas migrations)

### 4.2 Para evitar o erro clássico de CORS
- ✅ Frontend corre em `http://localhost:5173` **ou**
- ✅ CORS no backend foi ajustado para aceitar a origin real do frontend

---

## 5) Exemplo de `backend/.env` (dev)

> Ajusta nomes/valores conforme o teu `.env.example`.

```env
# HTTP
PORT=3000
NODE_ENV=development

# DB (Prisma)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/incidentdb?schema=public

# Audit (opcional mas recomendado)
AUDIT_HMAC_SECRET=dev-secret-change-me

# Datadog (opcional)
DD_TRACE_SAMPLE_RATE=1
DD_SERVICE=ims-backend
DD_ENV=development
DD_VERSION=dev

# Seeds (opcional)
SEED_PREFIX=DevSeed:
SEED_COUNT=500
SEED_BASE_DATE=2025-12-15
SEED_WINDOW_DAYS=30
SEED_RESET=true
SEED_RUN_ID=local
```

---

## 6) Recomendações para ficar “top” (profissional)

### 6.1 Centralizar config num módulo
Cria um `ConfigModule` (Nest) ou pelo menos um `src/config/config.ts` que:
- lê env vars,
- aplica defaults,
- valida tipos,
- e exporta um objeto `config` para o resto do código.

### 6.2 Documentação por secções
Sugestão de estrutura para docs de config:

```
docs/
  Backend/
    00_README.md
    01_SETUP_LOCAL_BACKEND.md
    Config/
      02_CONFIGURATION.md
      03_ENV_REFERENCE.md
      04_CORS_AND_FRONTEND.md
      05_OBSERVABILITY_DDTRACE.md
      06_SEED_AND_TEST_DATA.md
```

### 6.3 Segurança
- Nunca commitar `.env`
- Em produção, secrets via CI/CD (GitHub Actions, Render, Fly, etc.)
- Rotacionar `AUDIT_HMAC_SECRET` com cuidado (pode invalidar validações se estiveres a comparar histórico)

---

## 7) Troubleshooting rápido

- **CORS bloqueado**
  - Confirma origin do frontend (porta)
  - Ajusta `enableCors` para aceitar a origin real

- **Prisma: “P1001 can’t reach database server”**
  - A BD não está a correr, host errado, porta errada, ou `DATABASE_URL` inválida

- **PDF export dá 409 (Integrity check failed)**
  - `AUDIT_HMAC_SECRET` ativo + `auditHash` não bate com o calculado
  - Verifica se houve alterações manuais em DB ou seed que não correu `ensureIncidentAuditHash`

---

## 8) Próximo ficheiro recomendado
**03_ENV_REFERENCE.md** — tabela “name / required / default / where used / notes” para todas as env vars do backend (incluindo auth/jwt quando enviares esses ficheiros).
