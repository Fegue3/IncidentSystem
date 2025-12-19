# main.tsx (entry)

Ponto de entrada do frontend (React + Vite).

## Responsabilidade única

- Criar a root (`ReactDOM.createRoot`) e renderizar a app.
- Compor providers globais:
  - `<AuthProvider />` (autenticação)
  - `<BrowserRouter />` (routing)
  - `<AppRoutes />` (rotas da app)

## Notas

- `React.StrictMode` pode disparar efeitos duas vezes em dev (comportamento esperado).
- Importa `index.css` com tokens do design system (CSS variables).
