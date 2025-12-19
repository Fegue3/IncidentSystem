# AppLayout (layouts/AppLayout/AppLayout.tsx)

Layout principal da app privada.

## Responsabilidade única

- Renderizar o header com branding e `<TopNav />`.
- Disponibilizar área principal para páginas via `<Outlet />`.

## Estrutura

- Header fixo/visível: título “Incident Manager” + tagline.
- Conteúdo: `<main>` com a página atual.

## Dependências

- `react-router-dom` (`Outlet`)
- `TopNav` (components)
- CSS: `AppLayout.css`

## Notas

- Todas as rotas privadas são renderizadas dentro deste layout (via `AppRoutes`).
