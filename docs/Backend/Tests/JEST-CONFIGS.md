# Configurações Jest (Unit / Integration / E2E)

Esta pasta contém **3 configurações Jest** separadas, para manter:
- execução previsível,
- tempos/timeout adequados por tipo de teste,
- e outputs de coverage independentes (quando aplicável).

## Ficheiros

- `test/config/jest.unit.config.ts`
  - **Scope:** `test/unit/**.spec.ts`
  - **Objetivo:** testar lógica isolada com dependências mockadas.
  - **Coverage:** `coverage/unit`

- `test/config/jest.int.config.ts`
  - **Scope:** `test/integration/**/*.spec.ts`
  - **Objetivo:** testar integração entre módulos/DB/queries/fixtures (sem necessariamente HTTP).
  - **Coverage:** `coverage-integration`

- `test/config/jest.e2e.config.ts`
  - **Scope:** `test/e2e/**/*.e2e.spec.ts`
  - **Objetivo:** validar fluxos completos via HTTP (Nest app + guards + pipes + DB).
  - **Coverage:** (não definido aqui — tipicamente opcional em E2E)

## Como correr

### Unit
```bash
npx jest -c test/config/jest.unit.config.ts
```

### Integration
```bash
npx jest -c test/config/jest.int.config.ts
```

### E2E
```bash
npx jest -c test/config/jest.e2e.config.ts
```

### Correr um teste específico
```bash
npx jest -c test/config/jest.int.config.ts test/integration/reports.int.spec.ts
```

### Correr por pattern (nome do teste)
```bash
npx jest -c test/config/jest.e2e.config.ts -t "GET /api/reports"
```

## Decisões e rationale

### `maxWorkers: 1` em Integration e E2E
Integração/E2E tendem a partilhar recursos (DB, fixtures, portas, estado global). Forçar execução
sequencial reduz flakiness e torna os testes mais determinísticos.

Se no futuro quiserem paralelizar:
- garantir DB isolada por worker (schema por worker) **ou**
- garantir reset completo e sem “race conditions”.

### Timeouts por nível
- Unit: timeout default do Jest geralmente chega (normalmente rápido).
- Integration: `30s` cobre reset/queries sem “mascarar” lentidão real.
- E2E: `60s` cobre bootstrap da app + requests + persistência.

## Manutenção

Checklist rápida quando adicionares novos testes:
- Unit: o ficheiro deve terminar em `.spec.ts` e viver em `test/unit/`
- Integration: manter o sufixo `*.int.spec.ts` (recomendado), mas o match é `**/*.spec.ts`
- E2E: o ficheiro deve terminar em `.e2e.spec.ts`

Se mudares a estrutura de pastas, atualiza:
- `rootDir`
- `testMatch`/`testRegex`
- paths de coverage (`collectCoverageFrom`, `coverageDirectory`)
