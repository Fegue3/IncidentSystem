# Testes (Backend)

Este projeto usa **Jest** para testes **Unit**, **Integration** e **E2E**, com configs separadas por tipo.  
A pasta `test/` está organizada para manter **cenários claros**, **helpers reutilizáveis** e **execução previsível** (local e CI).

## Estrutura

```
test/
  config/
    jest.unit.config.ts
    jest.int.config.ts
    jest.e2e.config.ts

  unit/
    *.spec.ts

  integration/
    _helpers/
      prisma-reset.ts
    *.int.spec.ts

  e2e/
    _helpers/
      e2e-utils.ts
    *.e2e.spec.ts
```

### O que cada nível valida

- **Unit (`test/unit`)**
  - Testa funções/classes isoladas.
  - Dependências externas devem ser **mockadas** (ex.: PrismaService, gateways, serviços externos).
  - Objetivo: lógica + validações + erros.

- **Integration (`test/integration`)**
  - Testa a integração entre módulos/infra interna (ex.: Prisma real, DB real).
  - Usa helpers como `prisma-reset.ts` para garantir estado limpo e determinístico.
  - Objetivo: queries, filtros, relações, regras de domínio com persistência.

- **E2E (`test/e2e`)**
  - Testa a API “de ponta a ponta” (HTTP + validações + guards + DB + serialização).
  - Helpers em `e2e-utils.ts` normalmente fazem bootstrap da app, setup de auth, requests, etc.
  - Objetivo: endpoints, auth, permissões, contracts e fluxos completos.

## Como executar

> Os comandos abaixo usam **Jest diretamente** com as configs em `test/config/`.
> Se o teu `package.json` tiver scripts (ex.: `test:unit`), podes usá-los — estes comandos funcionam sempre.

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

### Executar um ficheiro específico
```bash
npx jest -c test/config/jest.unit.config.ts test/unit/auth.service.spec.ts
```

### Executar por “nome” (pattern)
```bash
npx jest -c test/config/jest.e2e.config.ts -t "GET /api/reports"
```

### Watch (útil em Unit)
```bash
npx jest -c test/config/jest.unit.config.ts --watch
```

## Ambiente e base de dados

- Normalmente os testes **integration/e2e** precisam de uma DB de teste (ex.: Postgres num container).
- O projeto inclui `.env.test` (e/ou `.env.example`) para configurar as variáveis usadas nos testes.
- Boas práticas:
  - Usar **base de dados dedicada** para testes (nunca a de dev/prod).
  - Isolar por schema/database ou limpar dados a cada suite (ex.: helper `prisma-reset.ts`).

### Reset/limpeza (Integration)
- `test/integration/_helpers/prisma-reset.ts` deve garantir:
  - limpeza consistente,
  - ordem correta (FKs),
  - e execução rápida para não tornar os testes lentos.

### Helpers E2E
- `test/e2e/_helpers/e2e-utils.ts` deve centralizar:
  - bootstrap da app Nest (`createTestingModule`, `app.init()`),
  - helper de login/registo e captura de token,
  - helper de requests (supertest),
  - teardown (`app.close()`).

## Convenções

### Nomes e sufixos
- Unit: `*.spec.ts`
- Integration: `*.int.spec.ts`
- E2E: `*.e2e.spec.ts`

### Arrange / Act / Assert
Manter o padrão dentro de cada teste:
1. **Arrange** (setup / dados / mocks)
2. **Act** (chamada)
3. **Assert** (expectativas)

### Determinismo
Evitar flakiness:
- datas “fixas” em testes (ou congelar tempo com `jest.useFakeTimers()` quando fizer sentido),
- seeds previsíveis,
- evitar dependência de ordem (cada teste deve ser independente).

## Cobertura (coverage)

Se a config suportar:
```bash
npx jest -c test/config/jest.unit.config.ts --coverage
```

Sugestão de foco:
- Unit: cobertura alta em regras/validações/erros.
- Integration/E2E: cobertura focada em fluxos e contratos (não precisa ser “100%”).

## Documentação dos testes (Markdown)

Recomendação: manter docs em `docs/tests/` (espelhando a estrutura do `test/`).

Exemplo de organização:
```
docs/tests/
  README.md
  unit/
    README.md
    auth.service.spec.md
  integration/
    README.md
    prisma-reset.md
  e2e/
    README.md
    e2e-utils.md
```

Cada `*.md` deve responder rápido:
- O que este spec valida (e porquê)
- Pré-condições (DB/reset/auth)
- Cenários cobertos (lista)
- Erros/edge cases
- Como correr só aquele teste

## Troubleshooting (rápido)

- **Testes E2E a falhar por timeout**
  - aumentar timeout na config E2E, ou otimizar reset/seed.
- **Falhas intermitentes**
  - procurar dependência de ordem, dados partilhados entre testes, ou datas aleatórias.
- **DB “suja” entre testes**
  - garantir que o reset roda em `beforeEach`/`beforeAll` conforme o objetivo.

---

Se quiseres, eu também gero automaticamente a estrutura inicial em `docs/tests/` (README por nível)
e depois criamos 1 `.md` por spec (`unit/int/e2e`) à medida que fores mandando os ficheiros.
