# Backend Seeds (Prisma) — Documentação Profissional

Este documento descreve o **sistema de seeds do backend** (TypeScript + Prisma) do IMS: para que servem, como são executadas, garantias (idempotência/determinismo), e variáveis de ambiente relevantes.

---

## 1) Objetivo das seeds no IMS

As seeds existem para garantir que qualquer dev/test runner consegue ter uma base de dados com:
- **catálogos mínimos** (teams, services, categories, tags)
- **personas/users** (com emails fixos e roles)
- **dataset realista de incidentes** para dashboards, reports, filtros, métricas e exportações (CSV/PDF)

Isto permite:
- demonstrações consistentes
- testes reprodutíveis
- desenvolvimento do frontend/backend sem “dados manuais”

---

## 2) Ficheiros e responsabilidades

### 2.1 `backend/prisma/seed.ts` — Seed “base” (catálogos + personas)
Cria/atualiza os dados fundamentais do sistema:

**Cria / garante:**
- Teams: `IT Ops`, `NOC`, `SRE`, `Service Desk`, `Compliance & Risk`
- Users (personas) com emails estáveis e roles (`ADMIN`/`USER`)
- Services (catálogo de componentes/sistemas afetados)
- Categories (tipos de problema)

**Propriedades importantes**
- **Idempotente por design** (usa `upsert`):
  - correr várias vezes não duplica dados
  - atualiza nome/role/descrições quando necessário
- **Estável**: emails, keys de serviços e nomes de equipa são determinísticos e usados como referência por outras seeds.

**Dependências**
- Schema Prisma com modelos `Team`, `User`, `Service`, `Category`.
- É pré-requisito para `seed.incidents.ts`.

---

### 2.2 `backend/prisma/seed.incidents.ts` — Seed de incidentes realistas (dataset para reports)
Gera um conjunto grande de incidentes “realistas” distribuídos num período (ex.: 30 dias), com:
- `Incident` + `comments` + `timeline`
- `categories` + `tags`
- `sources` (integrações externas, opcional)
- `CAPA` (opcional, para SEV1/SEV2 resolvidos/fechados)
- `subscriptions` (notificações por incident)

**Propriedades importantes**
- **Determinismo/consistência temporal (UTC)**:
  - Datas geradas em UTC (evita diferenças por timezone)
  - `BASE_DATE_STR` fixa o “hoje” do dataset por default
- **Pseudo-random determinístico (LCG)**:
  - usa um gerador pseudo-aleatório determinístico para distribuição, mantendo dados repetíveis
- **Idempotência protegida por prefixo**:
  - por defeito **não apaga nada**
  - se já existirem incidentes com `title` a começar com `SEED_PREFIX`, faz **SKIP**
  - se quiseres recriar, usas `SEED_RESET=true` (apaga apenas os seedados via prefixo)

**Dependências**
- Requer que `seed.ts` já tenha corrido, porque depende de:
  - users/personas por email fixo
  - teams existentes por name
  - services ativos existentes
  - categories existentes
  - tags são garantidas internamente (via upsert), mas depende do modelo existir.

---

### 2.3 `backend/prisma/seed.runner.ts` — Runner (orquestração)
Responsável por correr as seeds na ordem correta:

1) `seed.ts` (base: catálogos + personas)
2) `seed.incidents.ts` (dataset de incidentes)

**Comportamento**
- Executa via `spawnSync` e herda stdout/stderr (fica “visível” no terminal)
- Se qualquer comando falhar (status != 0), termina o processo com erro.

---

## 3) Ordem correta de execução

A ordem certa é **obrigatória**:

1. `seed.ts`  
2. `seed.incidents.ts`

O `seed.incidents.ts` faz validação “hard fail” (strict) para garantir que:
- os users/personalidades existem
- existem services ativos
- existem categories

Se não existir, ele falha com erro explícito para evitar datasets incompletos.

---

## 4) Idempotência: como evitam duplicação e “lixo” na DB

### `seed.ts`
- Usa `upsert` com chaves únicas:
  - Team: `name`
  - User: `email`
  - Service: `key`
  - Category: `name`
- Reexecutar não duplica linhas.

### `seed.incidents.ts`
- Usa uma estratégia segura baseada em **prefixo**:
  - Apenas considera seedado o que tem `title` a começar com `SEED_PREFIX`
- Modo default:
  - Se já houver seedados → **SKIP** (não cria mais)
- Modo reset:
  - `SEED_RESET=true` → apaga apenas seedados e recria

> Isto evita apagar incidentes “reais” ou dados de testes manuais.

---

## 5) Variáveis de ambiente suportadas

### Para `seed.incidents.ts`
- `SEED_PREFIX` (default: `TestSeed:`)
  - prefixo usado no título para identificar incidentes seedados
- `SEED_COUNT` (default: `500`)
  - total de incidentes a gerar
- `SEED_BASE_DATE` (default: `2025-12-15`)
  - “hoje” lógico do dataset (fixa o período)
- `SEED_WINDOW_DAYS` (default: `30`)
  - tamanho da janela temporal para distribuição
- `SEED_RESET` (`1|true|yes`)
  - apaga e recria incidentes seedados (apenas com prefixo)
- `SEED_RUN_ID` (default: `default`)
  - string para diferenciar runs (entra no externalId e payload)

---

## 6) Qualidade do dataset (porque isto gera dados úteis)

O seed de incidentes não cria só “linhas”, cria um dataset bom para relatórios:

- Distribuição por dias com **spikes** (picos) em offsets fixos
- Atribuição por “team weights” (SRE/IT Ops/NOC/etc.)
- Severidade ajustada por equipa e contexto (ex.: Compliance tende a ter SEV mais alto)
- Estados calculados por “idade” do incidente (mais antigo → mais provável estar CLOSED)
- Timeline coerente:
  - NEW → TRIAGED → IN_PROGRESS → RESOLVED → CLOSED (ou ON_HOLD / REOPENED)
- Métricas preenchidas (`triagedAt`, `resolvedAt`, etc.) para MTTA/MTTR
- Integrações opcionais com payload JSON e `externalId` deduplicável
- CAPA gerada em incidentes mais graves e já resolvidos/fechados

---

## 7) Como correr (exemplos)

### Correr tudo pela runner
```bash
npx ts-node prisma/seed.runner.ts
