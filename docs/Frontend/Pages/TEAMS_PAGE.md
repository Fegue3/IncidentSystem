# TeamsPage (pages/Teams/TeamsPage.tsx)

**Rota:** `/teams`

## Responsabilidade única
Gestão de equipas: listar, criar equipas e definir a “minha equipa” do utilizador.

## UI/UX
- Lista de equipas com contadores (membros/incidentes).
- Form para criar equipa.
- Select para escolher equipa principal; botão “Guardar equipa”.
- Persistência local da equipa selecionada em `localStorage`.

## Estado local (principais)
- Lista de equipas (`teams`) + estados de loading/erro.
- Criação de equipa (`newTeamName`, `creating`, `createError`).
- Seleção da equipa (`selectedTeamId`) + estados de saving e mensagem.

## APIs consumidas
- `TeamsAPI.listAll()` para lista completa.
- `TeamsAPI.listMine()` para equipa(s) do utilizador autenticado.
- `TeamsAPI.create(name)` para criar equipas.
- `TeamsAPI.addMember(teamId, userId)` e `TeamsAPI.removeMember(teamId, userId)` para gerir pertença.

## Dependências
- Contexto: `useAuth()` (user).
- React hooks `useMemo`, `useEffect`, `useState`.
- CSS: `TeamsPage.css`.

## Regras/validações
- Preferência de equipa inicial: tenta `/teams/me`, caso falhe cai para `localStorage`.
- Ao guardar equipa: se `selectedTeamId` vazio, remove o user de todas as equipas de `/teams/me`.

## Erros e estados vazios
- Falhas de carregamento/criação/guardar são comunicadas ao utilizador.

## Segurança e permissões
- Operações requerem sessão válida (rotas privadas).

## Performance
- Após ações, recarrega contagens chamando `listAll()` (aceitável para listas pequenas).

## Testabilidade
- —

## Notas
- —
