# IncidentDetailsPage (pages/Incidents/IncidentDetailsPage.tsx)

**Rota:** `/incidents/:id`

## Responsabilidade única
Detalhes do incidente: estado, severidade, owner, comentários e timeline (com heurísticas para interpretar eventos).

## UI/UX
- Header com ID, título, chips (status, SEV, equipa, serviço) e ações (voltar, apagar).
- Gestão do incidente: alterar estado (com mensagem opcional), severidade, owner.
- Painel principal: descrição + timeline (expand/collapse).
- Sidebar: comentários + formulário para adicionar comentário.

## Estado local (principais)
- `incident` + loading/erro.
- Gestão: selectedStatus/statusMessage, selectedSeverity, selectedOwnerId.
- Erros individuais: statusError, severityError, ownerError, commentError, deleteError.
- Owners: availableOwners + loading/erro.
- Timeline UI: timelineExpanded + scroll ref.
- Decorações/hints para FIELD_UPDATE “vazio” (pendingHint + decorations).

## APIs consumidas
- `IncidentsAPI.get(id)` (carregar/recarregar).
- `IncidentsAPI.changeStatus(id, { newStatus, message? })`.
- `IncidentsAPI.updateFields(id, { severity?, assigneeId? })`.
- `IncidentsAPI.addComment(id, { body })`.
- `IncidentsAPI.delete(id)` (apenas reporter).
- `TeamsAPI.listMembers(teamId)` (para dropdown de owners).

## Dependências
- React Router: `useParams`, `useNavigate`.
- Contexto: `useAuth` (user e permissões).
- Helpers de domínio (`getSeverityLabel`, `getSeverityShortLabel`).
- CSS: `IncidentDetailsPage.css`.

## Regras/validações
- Transições de estado permitidas via `getAllowedNextStatuses(current)`.
- Permissões: enquanto não houver owner, reporter pode editar; após owner, só o owner pode editar.
- Apagar incidente apenas quando `reporter.id === user.id`.
- Timeline: tenta normalizar payloads diferentes (`changes/diff/payload/data/meta/details`).

## Erros e estados vazios
- Mostra erro se não carregar incidente.
- Erros por operação (status/severity/owner/comment/delete) não rebentam a página.
- Estados vazios: sem comentários / sem timeline suficiente para scroll.

## Segurança e permissões
- O frontend aplica regras de UI, mas o backend deve validar permissões (fonte de verdade).

## Performance
- Após operações, recarrega o incidente (mantém consistência).
- Timeline expandível evita render gigante por defeito.

## Testabilidade
- Unit: normalizadores (normalizeChanges, getSeverityChange, getOwnerChange).
- Integration: mock de incidente com timeline variada e valida render.

## Notas
- Se o backend normalizar o formato de timeline, a heurística pode ser simplificada.
