# Frontend Documentation

Este diretório contém a documentação **do Frontend** (Vite + React + TypeScript) do projeto *Incident Manager*.

A documentação está organizada por domínio (Routing, Pages, Services, Design System, etc.) para manter **responsabilidade única por ficheiro** e permitir localizar rapidamente:
- o que existe;
- porque existe;
- como se usa;
- quais são as dependências, invariantes e edge cases.

---

## Estrutura recomendada de docs

```text
docs/
  Frontend/
    README.md
    FRONTEND_OVERVIEW.md
    FRONTEND_STRUCTURE_RECOMMENDED.md
    SETUP_LOCAL_FRONTEND.md
    MAIN_ENTRY.md

    DesignSystem/
      01_Introduction.md
      02_Colors.md
      03_Typography.md
      04_Layout_Grid.md
      05_Components.md
      06_Interactions.md

    Routing/
      ROUTING.md
      APP_ROUTES.md

    Layouts/
      APP_LAYOUT.md

    Context/
      AUTH_CONTEXT.md

    Components/
      TOP_NAV.md

    Services/
      API.md
      USERS.md
      TEAMS.md
      SERVICES.md
      INCIDENTS.md
      REPORTS.md

    Pages/
      HOME_PAGE.md
      LOGIN_PAGE.md
      SIGNUP_PAGE.md
      ACCOUNT_PAGE.md
      TEAMS_PAGE.md
      INTEGRATIONS_PAGE.md
      REPORTS_PAGE.md
      INCIDENT_CREATE_PAGE.md
      INCIDENT_DETAILS_PAGE.md
      NOT_FOUND_PAGE.md
```

> Nota: os nomes são **estáveis** e orientados a “o que é” (ex.: `INCIDENT_DETAILS_PAGE.md`) para evitar renomes frequentes quando o código muda pouco.

---

## Mapa rápido: código ↔ docs

```text
frontend/src/
  main.tsx                 -> docs/Frontend/MAIN_ENTRY.md
  index.css                -> docs/Frontend/DesignSystem/*
  routes/AppRoutes.tsx     -> docs/Frontend/Routing/APP_ROUTES.md
  layouts/AppLayout/*      -> docs/Frontend/Layouts/APP_LAYOUT.md
  context/AuthContext.tsx  -> docs/Frontend/Context/AUTH_CONTEXT.md
  components/TopNav/*      -> docs/Frontend/Components/TOP_NAV.md
  services/*.ts            -> docs/Frontend/Services/*
  pages/**                 -> docs/Frontend/Pages/*
```

---

## O que cada documento cobre

### Documentos base
- **FRONTEND_OVERVIEW.md** — visão geral (stack, responsabilidades, princípios e decisões).
- **FRONTEND_STRUCTURE_RECOMMENDED.md** — estrutura de pastas recomendada (quando criar `/hooks`, `/utils`, `/types`, etc.).
- **SETUP_LOCAL_FRONTEND.md** — setup do frontend em local (env, comandos, troubleshooting).
- **MAIN_ENTRY.md** — ponto de entrada (`main.tsx`) e estilos globais (tokens + resets).

### Design System
Os ficheiros em `DesignSystem/` documentam as regras visuais e tokens (cores, tipografia, espaçamento, componentes e interações). São a referência para CSS e UI consistente.

### Routing
- **ROUTING.md** — princípios (público/privado, navegação, redirects, `next`, regras).
- **APP_ROUTES.md** — rotas atuais e comportamento do `PrivateRoute`.

### Layouts, Context e Components
- **APP_LAYOUT.md** — layout base, slots, e pontos de extensão.
- **AUTH_CONTEXT.md** — estado e ações de autenticação, persistência e considerações de segurança.
- **TOP_NAV.md** — navegação principal e links disponíveis.

### Services
Os ficheiros em `Services/` descrevem a “API layer” do frontend:
- `api.ts` (fetch wrapper, auth headers, refresh, erros).
- `incidents.ts`, `reports.ts`, `services.ts`, `teams.ts`, `users.ts` (contratos e chamadas HTTP).

> Objetivo: manter o comportamento HTTP (URLs, payloads, tipagem) documentado sem precisar “abrir o código” para tudo.

### Pages
Cada página tem um documento focado em:
- propósito;
- dependências (services/context/layout);
- fluxo UI (estados `loading/error/empty`);
- regras/validações importantes;
- pitfalls conhecidos.

---

## Regras para manter esta documentação “viva”

1. **Mudaste uma rota?** Atualiza `Routing/APP_ROUTES.md` e, se necessário, os docs das páginas afetadas.
2. **Mudaste um contrato de API?** Atualiza o doc em `Services/` correspondente e menciona mudanças breaking.
3. **Mudaste tokens CSS/estilos globais?** Atualiza `DesignSystem/02_Colors.md`, `03_Typography.md` e `MAIN_ENTRY.md`.
4. **Evita duplicação**: decisões transversais ficam em `FRONTEND_OVERVIEW.md`; detalhes ficam no doc do módulo/página.

---

## Convenções de escrita (curtas e consistentes)

- Começar cada doc com: **Responsabilidade**, **Contexto**, **Como usar**, **Dependências**, **Estados/erros**, **Notas**.
- Usar exemplos pequenos e concretos (não “bla bla”).
- Preferir tipagem explícita (evitar `any`) e explicar *porquê* quando existe um cast.

