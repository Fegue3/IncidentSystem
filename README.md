# 📚 Documentação — Incident Management System

Este repositório contém um **Incident Management System** com:
- **Backend** (NestJS + Prisma + PostgreSQL + Redis)
- **Frontend** (React + Vite + TypeScript)
- **Infra/Observabilidade** (Docker Compose + Datadog opcional)
- **Testes** (backend: unit / integration / e2e)

A pasta `docs/` é a fonte oficial de documentação funcional/arquitetural do projeto.

---

## 🧭 Índice rápido

### Setup
- `SETUP.md` — Guia rápido para levantar o projeto em dev (cross-platform).
- `docs/DOCKERSETUP.md` — Explicação do stack Docker (dev + CI), serviços, volumes, redes, healthchecks e troubleshooting.

### Arquitetura / Stack
- `docs/STACK.md` — Visão geral do stack, responsabilidades e decisões (alto nível).
- `docs/INCIDENTS-LOGIC.md` — Regras/restrições do domínio “Incidentes” (lógica funcional).

### Documentação do Backend
- `docs/Backend/README.md` — Como navegar a documentação do backend (mapa + links).
- `docs/Backend/00_BACKEND-OVERVIEW.md` — Overview do backend: módulos, boundaries e fluxo request→response.
- `docs/Backend/01_SETUP_LOCAL_BACKEND.md` — Setup local do backend (sem Docker, ou híbrido).
- `docs/Backend/02_CONFIGURATION_BACKEND.md` — Configuração (env vars, portas, JWT, Redis, Datadog, etc).
- `docs/Backend/03_SETUP_DOCKER_BACKEND.md` — Como correr backend via Docker Compose (one-command dev).

#### Backend → Database
- `docs/Backend/Database/README.md` — Mapa da documentação de base de dados.
- `docs/Backend/Database/SCHEMA.md` — Estrutura do schema (entidades e relações).
- `docs/Backend/Database/MIGRATIONS.md` — Como funcionam migrations (Prisma) e como adicionar novas.
- `docs/Backend/Database/SEED-LOGIC.md` — Como funciona a seed (dados gerados, parâmetros, invariantes).

#### Backend → Modules (NestJS)
- `docs/Backend/Modules/README.md` — Mapa dos módulos do backend.
- `docs/Backend/Modules/APP.md` — AppModule, bootstrap e wiring global.
- `docs/Backend/Modules/AUTH.md` — Auth: JWT, guards, strategies, roles.
- `docs/Backend/Modules/HEALTH.md` — Health endpoints e readiness.
- `docs/Backend/Modules/INCIDENTS.md` — Incidents: endpoints, validações, filtros e regras.
- `docs/Backend/Modules/REPORTS.md` — Reports: KPIs, breakdowns, timeseries, exports (CSV/PDF).
- `docs/Backend/Modules/SERVICES.md` — Services: listagem/lookup e filtros.
- `docs/Backend/Modules/TEAMS.md` — Teams: membership, permissões e scoping.
- `docs/Backend/Modules/USERS.md` — Users: perfil, repositório e queries.
- `docs/Backend/Modules/PRISMA.md` — PrismaService/PrismaModule e padrões de acesso a BD.
- `docs/Backend/Modules/NOTIFICATIONS.md` — Integrações/Notificações (redis/webhooks/dispatch).

#### Backend → Tests
- `docs/Backend/JEST-CONFIGS.md` — Como estão separados unit/integration/e2e (configs e convenções).
- `docs/Backend/Tests/unit/UNIT.md` — Testes unitários (o que cobrem e como executar).
- `docs/Backend/Tests/integration/INTEGRATION.md` — Integração (com DB/Redis; estratégia de reset).
- `docs/Backend/Tests/integration/PRISMA-RESET.md` — Reset da BD em testes (helper).
- `docs/Backend/Tests/e2e/E2E.md` — E2E (setup, helpers, contratos).
- `docs/Backend/Tests/e2e/E2E-UTILS.md` — Helpers utilitários (tokens, seed, factories).

---

## 📁 Documentação do Frontend

A documentação do frontend está organizada por **área funcional** (Pages/Components/Services/Routing/Context/Layouts)
e por **design system**.

### Frontend → visão geral
- `docs/Frontend/README.md` — Mapa da documentação do frontend (este “hub”).
- `docs/Frontend/00_FRONTEND_OVERVIEW.md` — Arquitetura geral: state, routing, estrutura e convenções.
- `docs/Frontend/01_FRONTEND_STRUCTURE_RECOMMENDED.md` — Estrutura sugerida e boas práticas (naming, pastas, imports).
- `docs/Frontend/02_MAIN_ENTRY.md` — Entry points (Vite), `main.tsx`, providers e bootstrap.
- `docs/Frontend/03_SETUP_LOCAL_FRONTEND.md` — Setup local do frontend (env vars, dev server, build, lint).

### Frontend → Pages
Cada página tem um `.md` com responsabilidade, fluxo de dados, estados, erros e extensões futuras:
- `docs/Frontend/Pages/HOME_PAGE.md` — Dashboard/kanban de incidentes e filtros.
- `docs/Frontend/Pages/INCIDENT_CREATE_PAGE.md` — Criação de incidente (validações + seleção de serviço).
- `docs/Frontend/Pages/INCIDENT_DETAILS_PAGE.md` — Detalhe do incidente (status/sev/owner + timeline + comments).
- `docs/Frontend/Pages/REPORTS_PAGE.md` — Relatórios (KPIs, breakdown, timeseries, export CSV/PDF).
- `docs/Frontend/Pages/TEAMS_PAGE.md` — Gestão/listagem de equipas e membros.
- `docs/Frontend/Pages/INTEGRATIONS_PAGE.md` — Vista de integrações (Datadog/PagerDuty/Discord).
- `docs/Frontend/Pages/ACCOUNT_PAGE.md` — Definições de conta (logout/delete-account).
- `docs/Frontend/Pages/LOGIN_PAGE.md` — Login.
- `docs/Frontend/Pages/SIGNUP_PAGE.md` — Registo.
- `docs/Frontend/Pages/NOT_FOUND_PAGE.md` — 404.

### Frontend → Components / Layouts / Context
- `docs/Frontend/Components/TOP_NAV.md` — `TopNav`: navegação principal e rotas.
- `docs/Frontend/Layouts/APP_LAYOUT.md` — `AppLayout`: header, shell e outlet.
- `docs/Frontend/Context/AUTH_CONTEXT.md` — `AuthContext`: estado auth + login/register/logout.

### Frontend → Routing
- `docs/Frontend/Routing/ROUTING.md` — Estratégia de routing (React Router), guards e redirects.
- `docs/Frontend/Routing/APP_ROUTES.md` — Mapa de rotas (path → page/layout).

### Frontend → Services (API client)
- `docs/Frontend/Services/API.md` — Wrapper `api.ts`, autenticação, tokens e erros.
- `docs/Frontend/Services/INCIDENTS.md` — `incidents.ts`: endpoints, filtros e tipos.
- `docs/Frontend/Services/REPORTS.md` — `reports.ts`: KPIs/breakdown/timeseries/exports.
- `docs/Frontend/Services/SERVICES.md` — `services.ts`: listagem de serviços.
- `docs/Frontend/Services/TEAMS.md` — `teams.ts`: equipas e membros.
- `docs/Frontend/Services/USERS.md` — `users.ts`: `me()` e tipos de utilizador.

### Frontend → DesignSystem
- `docs/Frontend/DesignSystem/01_Introduction.md` — Princípios e objetivos do design system.
- `docs/Frontend/DesignSystem/02_Colors.md` — Paleta e estados (success/warn/error/neutral).
- `docs/Frontend/DesignSystem/03_Typography.md` — Tipografia e hierarquia.
- `docs/Frontend/DesignSystem/04_Layout_Grid.md` — Espaçamentos e grid/layout.
- `docs/Frontend/DesignSystem/05_Components.md` — Botões, chips, cards, tables, inputs.
- `docs/Frontend/DesignSystem/06_Interactions.md` — Estados, loading, empty/error, acessibilidade.

---

## 🔌 Integrações (observabilidade / notificações)
- `docs/Integrations/README.md` — Mapa de integrações suportadas.
- `docs/Integrations/DATADOG.md` — Datadog (agent, env vars, tracing).
- `docs/Integrations/PAGERDUTY.md` — PagerDuty (eventos e webhook flow).
- `docs/Integrations/DISCORD.md` — Discord (webhooks e payloads).

---

## ✅ Setup (nota rápida)

O fluxo típico em desenvolvimento (stack “one-command dev”) é:
1. `docker compose up -d --build` (sobe DB/Redis + backend opcional)
2. `cd frontend && npm ci && npm run dev` (sobe UI em modo dev)

> Se preferires correr o backend fora do Docker (hot-reload mais rápido):
> - manténs `postgres` + `redis` via Docker e corres o backend localmente com `npm run start:dev` no `backend/`.
> - neste caso, confirma que o `DATABASE_URL` aponta para `localhost:5432` (não para `postgres:5432`).

---

## 🗺️ Convenções
- Docs “por ficheiro/feature”: cada `.md` responde a **o que faz**, **porque existe**, **como usar**, **dependências**, **erros**, **segurança**, **edge cases**.
- Ficheiros em maiúsculas no `docs/` são **hubs**/páginas de navegação (mapas), e os restantes são documentação de área.

---

## 🔁 Como contribuir para a documentação
1. Cria/edita o `.md` na área correta (`docs/Frontend/...` ou `docs/Backend/...`).
2. Mantém exemplos curtos e práticos (requests/response, snippets).
3. Atualiza este `README` quando adicionares/removeres páginas importantes.
