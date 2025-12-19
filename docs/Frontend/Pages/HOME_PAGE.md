# HomePage (pages/HomePage/HomePage.tsx)

**Rota:** `/`

## Responsabilidade única
Dashboard dos incidentes do utilizador, com filtros locais e agrupamento por estado (Open / Investigating / Resolved).

## UI/UX
- Três colunas por estado com contadores.
- Filtros locais: estado, severidade, serviço, pesquisa livre.
- Ação primária: criar incidente (`/incidents/new`).
- Cards clicáveis que abrem detalhes (`/incidents/:id`).

## Estado local (principais)
- Perfil atual (`me`) e estados de loading/erro.
- Lista de incidentes (`incidents`) + loading/erro.
- Filtros locais (`filterStatus`, `filterSeverity`, `filterServiceKey`, `searchText`).
- Lista de serviços para o dropdown (apenas ativos).

## APIs consumidas
- `UsersAPI.me()` para obter utilizador atual.
- `ServicesAPI.list({ isActive: true })` para dropdown de serviços.
- `IncidentsAPI.list(...)` para incidentes filtrados (inclui `teamId` do `localStorage`).

## Dependências
- React hooks (`useEffect`, `useState`).
- React Router (`useNavigate`).
- Helpers do domínio (`getSeverityOrder`, `getSeverityShortLabel`).
- CSS: `HomePage.css`.

## Regras/validações
- Ordenação: severidade (SEV1 → SEV4) e depois data de criação.
- Scoping por equipa: lê `selectedTeamId` do `localStorage` (chave `selectedTeamId`).

## Erros e estados vazios
- Mostra mensagens quando falha carregar perfil, incidentes ou serviços.
- Estados vazios por coluna quando não há incidentes naquele grupo.

## Segurança e permissões
- Assume autenticação (rota privada); o token é aplicado em `IncidentsAPI`/`UsersAPI` via `api()`.

## Performance
- Cada mudança de filtro dispara `IncidentsAPI.list(...)` (pode ser otimizado com debounce na pesquisa).

## Testabilidade
- Unit: helpers de ordenação/agrupamento.
- Integration: mock de `IncidentsAPI.list` para validar render por estados e filtros.

## Notas
- Se ESLint reclamar com casts `as any` para `severity/status`, tipar os filtros para `SeverityCode | ''` e `IncidentStatus | ''` e eliminar o cast.
