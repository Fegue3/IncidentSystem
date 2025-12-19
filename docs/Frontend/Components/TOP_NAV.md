# TopNav (components/TopNav/TopNav.tsx)

Navegação principal da app (links no header).

## Responsabilidade única

- Expor links para páginas privadas (Dashboard, Relatórios, Equipas, Integrações, Conta).
- Realçar o link ativo via `NavLink`.

## Rotas

- `/`
- `/reports`
- `/teams`
- `/integrations`
- `/account`

## Dependências

- `react-router-dom` (`NavLink`)
- CSS: `TopNav.css`

## Acessibilidade

- `<nav aria-label="Navegação principal">` garante semântica correta.
- `NavLink` mantém navegação por teclado e estados ativos.
