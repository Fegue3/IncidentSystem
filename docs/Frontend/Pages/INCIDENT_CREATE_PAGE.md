# IncidentCreatePage (pages/Incidents/IncidentCreatePage.tsx)

**Rota:** `/incidents/new`

## Responsabilidade única
Criação de incidentes com validações, seleção de serviço e escolha opcional de owner inicial.

## UI/UX
- Form com título + descrição.
- Sidebar com Serviço, Severidade, e Owner inicial (Sem owner / Atribuir a mim).
- Ações: Cancelar e Criar incidente.

## Estado local (principais)
- Campos (`title`, `description`, `severity`, `primaryServiceId`, `ownerMode`).
- Carregamento: `servicesLoading`, `submitting`.
- Erros: `error`, `servicesError`.
- Utilizador atual (`me`) para resolver equipa principal.

## APIs consumidas
- `UsersAPI.me()` (para obter `teamId` quando disponível).
- `ServicesAPI.list({ isActive: true })` (serviços ativos).
- `IncidentsAPI.create(...)` (criação).

## Dependências
- React Router: `useNavigate`.
- Contexto: `useAuth` (para ownerMode=self).
- Constants: `TITLE_MAX_LENGTH`, `DESCRIPTION_MAX_LENGTH`.
- CSS: `IncidentCreatePage.css`.

## Regras/validações
- Valida título/descrição não vazios e limites de tamanho.
- Serviço é obrigatório e não pode ser trocado depois (nota UI).
- teamId é resolvido por prioridade: `me.team.id` → `localStorage(selectedTeamId)` → undefined.

## Erros e estados vazios
- Mostra mensagens de validação local e de falha no backend.
- Se não houver serviços ativos, o select fica sem opções úteis.

## Segurança e permissões
- Requer autenticação (rota privada).

## Performance
- —

## Testabilidade
- —

## Notas
- —
