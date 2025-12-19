# Routing (React Router)

A aplicação usa React Router v6 e separa rotas **públicas** e **privadas**.

## Entry point

- `main.tsx` cria a app e envolve:
  - `<AuthProvider />`
  - `<BrowserRouter />`
  - `<AppRoutes />`

## Rotas públicas

- `/login` → `LoginPage`
- `/signup` → `SignUpPage`

## Rotas privadas (protegidas por `PrivateRoute`)

Renderizam dentro de `<AppLayout />`:

- `/` → `HomePage`
- `/reports` → `ReportsPage`
- `/teams` → `TeamsPage`
- `/integrations` → `IntegrationsPage`
- `/account` → `AccountPage`
- `/incidents/new` → `IncidentCreatePage`
- `/incidents/:id` → `IncidentDetailsPage`

## Regras de acesso (frontend)

- Se não existir `accessToken` no contexto, a navegação é redirecionada para `/login?next=...`.
- O `next` preserva `pathname + search` para voltar após autenticação.
