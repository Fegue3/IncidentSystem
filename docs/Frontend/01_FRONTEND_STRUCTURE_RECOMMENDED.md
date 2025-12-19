# Frontend — Estrutura Recomendada (React + TypeScript)

_Data: 2025-12-18_

## Objetivo
Este documento define a **estrutura recomendada** para o projeto frontend, com foco em:
- separação clara de responsabilidades (UI vs integração vs estado)
- escalabilidade por feature
- consistência de naming e caminhos de import
- testabilidade e manutenção

---

## Estrutura recomendada (src)

> Base: o que já tens é bom. A recomendação abaixo apenas formaliza regras e adiciona pastas opcionais para crescer sem “entulho”.

```txt
src/
  main.tsx                 # entrypoint: render + providers + router
  index.css                # estilos globais mínimos (reset/base)

  App/
    App.tsx                # componente raiz (shell)
    App.css

  routes/
    AppRoutes.tsx          # mapeamento URL -> Pages + guards

  layouts/
    AppLayout/
      AppLayout.tsx        # layout partilhado (TopNav + container)
      AppLayout.css

  context/
    AuthContext.tsx        # estado global de sessão/auth

  services/
    api.ts                 # fetch wrapper + tokens + refresh + blob
    incidents.ts           # domínio Incidents (tipos + endpoints)
    reports.ts             # domínio Reports (kpis/breakdown/timeseries/exports)
    services.ts            # domínio Services (catalog)
    teams.ts               # domínio Teams (members, list, create)
    users.ts               # domínio Users (me/list/etc)

  components/              # UI reutilizável (não “feature-specific”)
    TopNav/
      TopNav.tsx
      TopNav.css
    ...

  pages/                   # ecrãs (normalmente 1 rota)
    HomePage/
      HomePage.tsx
      HomePage.css
      HomePage.test.tsx
    Incidents/
      IncidentCreatePage.tsx
      IncidentCreatePage.css
      IncidentDetailsPage.tsx
      IncidentDetailsPage.css
    Reports/
      ReportsPage.tsx
      ReportsPage.css
    Teams/
      TeamsPage.tsx
      TeamsPage.css
    Integrations/
      IntegrationsPage.tsx
      IntegrationsPage.css
    AccountPage/
      AccountPage.tsx
      AccountPage.css
    NotFoundPage/
      NotFoundPage.tsx
      NotFoundPage.css

  # Opcionais (recomendados quando o projeto cresce)
  hooks/                   # hooks reutilizáveis (ex.: useDebounce, useQueryState)
  utils/                   # helpers puros (formatters, dates, etc.)
  types/                   # tipos partilhados (se não forem de domínio em services)
  styles/                  # tokens/util CSS (se quiseres centralizar)
  assets/                  # imagens/svgs

  setupTests.ts            # setup do ambiente de testes
```

---

## Regras de organização (decisões de arquitetura)

### 1) Pages orquestram; Services executam IO
- **Pages**: estado (loading/error/data), eventos do utilizador, composição de UI.
- **services/**: HTTP/IO, query strings, normalização de payload.
- **components/**: UI pura (recebe props; não chama HTTP diretamente).

### 2) “Uma responsabilidade por ficheiro”
- Evitar “god files” com múltiplos domínios.
- Cada `services/<domain>.ts` deve tratar só 1 domínio.

### 3) Naming consistente
- Pages: `XxxPage.tsx`
- Components: `Xxx.tsx`
- CSS co-localizado: `Xxx.css`
- Serviços: `<domain>.ts` (plural ou singular consistente — o importante é ser estável)

### 4) Contratos de API: tipar e normalizar
- Preferir `type`/`interface` para o formato esperado.
- Quando o backend devolve estruturas diferentes (ex.: `userId` vs `id`), normalizar no service.

### 5) Erros e UX
- Toda page que faz IO deve tratar:
  - `loading`
  - `error` (mensagem para o utilizador)
  - `empty` (quando aplicável)

---

## Convenções de segurança
- O frontend **não** é autoridade de permissões.
- `AuthContext` e guards melhoram UX, mas o backend valida:
  - token
  - role
  - scoping/ownership (equipa)

Recomendação:
- `401` → limpar sessão + redirecionar para login
- `403` → mostrar “Sem permissões” e manter sessão

---

## Convenções de performance
- Usar filtros/paginação no backend sempre que possível.
- Debounce em campos de pesquisa (`search`, `q`) para evitar spam de requests.
- Evitar re-fetch duplicado quando navegas entre ecrãs (memoização ou cache simples se necessário).

---

## Checklist (PR)
- [ ] UI não faz `fetch` direto (usa `services/*`).
- [ ] Estados `loading/error/empty` tratados.
- [ ] Tipos coerentes (evitar `any`).
- [ ] Endpoint/contrato documentado quando introduzido.
- [ ] Testes para fluxos críticos.
