# AppRoutes (routes/AppRoutes.tsx)

Define as rotas da aplicação e aplica proteção de sessão nas páginas privadas.

## Responsabilidade única

- Declarar rotas públicas/privadas.
- Proteger rotas privadas com `PrivateRoute`.
- Preservar `next` (return URL) ao redirecionar para login.

## PrivateRoute

- Usa `useAuth()` para ler `accessToken`.
- Se não existir token:
  - Calcula `next = encodeURIComponent(pathname + search)`
  - Redireciona para `/login?next=...`
- Caso contrário, renderiza os `children`.

## Rotas

Ver `docs/Frontend/Routing/ROUTING.md`.
