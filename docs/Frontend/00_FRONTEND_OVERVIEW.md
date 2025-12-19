# Frontend — Visão Geral (React + TypeScript)

> Documento de alto nível para orientar a navegação do código, arquitetura de UI e convenções do frontend.

## Objetivo
O **frontend** é uma SPA (Single Page Application) em **React + TypeScript** (Vite) para o *Incident Management System (IMS)*. A aplicação fornece:
- UI para gestão de incidentes (criação, consulta e detalhe)
- UI para relatórios (KPIs, breakdowns e exportações)
- UI para equipas, integrações e conta
- Controlo de sessão e permissões (via contexto de autenticação)

---

## Tech Stack
- **React** (UI)
- **TypeScript** (tipagem e robustez)
- **Vite** (dev server + build)
- **CSS por ficheiro** (estilo local por componente/página)
- **Testes** com setup dedicado (`setupTests.ts`) e testes por página (ex.: `HomePage.test.tsx`)

---

## Estrutura de pastas
A estrutura prioriza **separação por responsabilidade**: rotas, páginas, layout, componentes, contexto e serviços.

```
frontend/
  public/
  src/
    main.tsx
    index.css

    App/
      App.tsx
      App.css

    routes/
      AppRoutes.tsx

    layouts/
      AppLayout/
        AppLayout.tsx
        AppLayout.css

    context/
      AuthContext.tsx

    components/
      TopNav/
        TopNav.tsx
        TopNav.css

    pages/
      HomePage/
        HomePage.tsx
        HomePage.css
        HomePage.test.tsx

      AccountPage/
        AccountPage.tsx
        AccountPage.css

      Auth/
        ...

      Incidents/
        IncidentCreatePage.tsx
        IncidentCreatePage.css
        IncidentDetailsPage.tsx
        IncidentDetailsPage.css

      Integrations/
        IntegrationsPage.tsx
        IntegrationsPage.css

      Reports/
        ReportsPage.tsx
        ReportsPage.css

      Teams/
        TeamsPage.tsx
        TeamsPage.css

      NotFoundPage/
        NotFoundPage.tsx
        NotFoundPage.css

    services/
      api.ts
      incidents.ts
      reports.ts
      services.ts
      teams.ts
      users.ts

    setupTests.ts

  package.json
  vite.config.ts
  tsconfig*.json
```

---

## Módulos e responsabilidades

### `src/main.tsx`
**Ponto de entrada** da aplicação:
- Cria o root React e faz `render()` da app.
- Aplica CSS global (`index.css`).
- Regista providers globais (ex.: `AuthContext`), caso existam.

### `src/App/App.tsx`
**Componente raiz** da aplicação:
- Compoõe layout + rotas (diretamente ou através de `AppRoutes`).
- Define a estrutura base do UI (shell) e o “entry-point” das páginas.

### `src/routes/AppRoutes.tsx`
**Orquestração de rotas**:
- Define o mapeamento *URL → Page*.
- Ponto ideal para:
  - “route guards” (rotas protegidas por sessão)
  - redirecionamentos (ex.: `/` → `/home`)
  - fallback para `NotFoundPage`

> Boas práticas:
> - Manter as rotas como “fonte de verdade” e evitar duplicação de paths.
> - Centralizar regras de acesso aqui (quando possível).

### `src/layouts/AppLayout/AppLayout.tsx`
**Layout partilhado** (shell):
- Estrutura comum às páginas (ex.: TopNav + content).
- Responsável por consistência visual e *page chrome*.
- Ideal para conter: navegação, breadcrumbs, footer, etc.

### `src/context/AuthContext.tsx`
**Estado global de autenticação**:
- Mantém informação da sessão (user, role, token, expiração).
- Fornece helpers como `login()`, `logout()`, `isAuthenticated`, etc.
- Permite *guards* e UI condicional por permissões (ex.: Admin vs User).

> Nota: este módulo é central para segurança no frontend, mas **a autoridade final é o backend**.
> O frontend apenas melhora UX (ocultar/mostrar opções).

### `src/components/*`
**Componentes reutilizáveis** de UI.
- Ex.: `TopNav` (navegação principal).
- Regra: componentes reutilizáveis **não devem** fazer chamadas HTTP diretamente.
  - Devem receber dados/handlers via props.
  - Chamadas à API devem residir em `services/*` e ser invocadas por Pages.

### `src/pages/*`
**Pages** representam ecrãs do produto (normalmente 1 por rota):
- Responsáveis por:
  - orquestrar dados (fetch, loading, error)
  - compor componentes
  - chamar a camada `services/*`

Exemplos:
- `Incidents/IncidentCreatePage.tsx`: formulário + submissão
- `Incidents/IncidentDetailsPage.tsx`: fetch do detalhe + render
- `Reports/ReportsPage.tsx`: fetch de KPIs/breakdown + export

### `src/services/*`
**Camada de acesso ao backend** (integração HTTP):
- `api.ts`: cliente HTTP e configuração transversal (base URL, headers, token, interceptores).
- `incidents.ts`, `reports.ts`, `teams.ts`, etc.: funções por domínio.

**Objetivo principal:** manter as Pages limpas e consistentes.
- Page = UI + orquestração
- Service = IO/HTTP + transformação de dados

---

## Fluxo de dados (alto nível)

### Fluxo típico (fetch)
1. Utilizador entra numa rota (Page é montada).
2. Page chama `services/<domain>.ts`.
3. `services/<domain>.ts` usa o cliente em `services/api.ts`.
4. Backend responde.
5. Page atualiza estado: `loading → success | error` e renderiza.

```
[Page] -> [services/domain.ts] -> [services/api.ts] -> [Backend REST]
  ^                                                     |
  +------------------------- response -------------------+
```

### Fluxo típico (auth)
1. Utilizador faz login.
2. AuthContext guarda a sessão (memória + storage, se aplicável).
3. `api.ts` injeta token nos pedidos.
4. Rotas protegidas dependem do estado do AuthContext.

---

## Convenções e padrões

### Naming & organização
- **Pages**: `XxxPage.tsx` (+ `XxxPage.css`).
- **Componentes**: `Xxx.tsx` (+ `Xxx.css`).
- **Services**: nomes por domínio (`reports.ts`, `incidents.ts`, etc.).
- **Uma responsabilidade por ficheiro** (evitar “god files”).

### CSS
- CSS está co-localizado com o TSX.
- Evitar estilos globais fora de `index.css`.
- Preferir classes específicas por componente/página (reduz colisões).

### Erros e estados de UI
Cada Page que faz IO deve modelar:
- `loading`: a pedir dados
- `empty`: sem dados (quando aplicável)
- `error`: falha de rede/validação/permissão
- `success`: render final

---

## Segurança & controlo de acesso
- O frontend usa o **AuthContext** para UX e controlo de navegação.
- **Não** assumir que “esconder botões” equivale a permissões.
- O backend deve validar **sempre**:
  - token/sessão
  - role (USER/ADMIN)
  - scoping (equipa/tenant, se aplicável)

Boas práticas:
- Tratar `401` como “sessão inválida” → redirecionar para login.
- Tratar `403` como “sem permissões” → mostrar mensagem e manter sessão.
- Não logar tokens em consola.

---

## Integração com a API (contract)
A camada `services/*` deve:
- definir funções com inputs claros (DTOs/params)
- encapsular a forma do request (path, query, body)
- normalizar respostas e erros num formato consistente

### Exemplo de uso (Page → Service)
```ts
// pages/Incidents/IncidentDetailsPage.tsx (exemplo conceptual)
import { useEffect, useState } from "react";
import { getIncidentById } from "../../services/incidents";

export function IncidentDetailsPage() {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    (async () => {
      try {
        const data = await getIncidentById("INCIDENT_ID");
        setState({ loading: false, error: null, data });
      } catch (e) {
        setState({ loading: false, error: e as any, data: null });
      }
    })();
  }, []);

  // render loading / error / success ...
  return null;
}
```

---

## Testabilidade
- `setupTests.ts` configura o ambiente de testes (mocks/globals/RTL).
- Testes por Page (ex.: `HomePage.test.tsx`) são recomendados para:
  - render básico
  - estados (loading/error/empty)
  - comportamento (click → chama handler)

Boas práticas:
- Preferir testes de comportamento (React Testing Library) vs detalhes internos.
- Mockar a camada `services/*` para isolar UI.
- Cobrir casos “felizes” e “falhas” (401/403/500).

---

## Performance & qualidade
- Evitar múltiplos fetches redundantes na mesma Page.
- Preferir *debounce* em pesquisas (`q=...`) se existir input de pesquisa.
- Tratar listas grandes com paginação no backend e UI (quando aplicável).
- Evitar renderizações desnecessárias:
  - memoização pontual (`useMemo`, `useCallback`) apenas quando necessário
  - componentes pequenos e bem isolados

---

## Scripts (package.json)
> Nota: os nomes exatos podem variar, mas o padrão Vite é tipicamente:

- `dev`: iniciar ambiente local
- `build`: build de produção
- `preview`: servir build localmente
- `test`: executar testes (se configurado)
- `lint`: lint (se configurado)

---

## Variáveis de ambiente
Se existir configuração via env (recomendado):
- `VITE_API_BASE_URL` — URL base do backend (ex.: `http://localhost:3000/api`)

> Importante: apenas variáveis com prefixo `VITE_` são expostas ao frontend em Vite.

---

## Regras de contribuição (PR checklist)
- [ ] A Page não faz HTTP diretamente (usa `services/*`).
- [ ] Estados `loading/error/empty` tratados.
- [ ] CSS co-localizado e sem estilos globais desnecessários.
- [ ] Tipos claros (sem `any` salvo exceções justificadas).
- [ ] Pelo menos 1 teste para comportamento crítico (quando aplicável).
- [ ] Erros 401/403 com UX coerente (mensagens + redirect quando adequado).

---

## Próximos documentos recomendados
- **Routing & Guards** (detalhar rotas, paths e regras por role)
- **AuthContext** (modelos de sessão, armazenamento, renovação)
- **Services contract** (endpoints, DTOs, modelos e erros)
- **Design system** (cores, tipografia e componentes — se existir guia interno)
