# AccountPage (pages/AccountPage/AccountPage.tsx)

**Rota:** `/account`

## Responsabilidade única
Gestão da conta do utilizador (ver perfil, terminar sessão, apagar conta).

## UI/UX
- Cards: Perfil, Sessão, Zona perigosa.
- Confirmação antes de apagar conta.

## Estado local (principais)
- `deleting` (loading) e `error` (delete-account).

## APIs consumidas
- `api('/auth/delete-account', { method: 'DELETE', auth: true })`
- `useAuth().logout()`

## Dependências
- React Router: `useNavigate`.
- Contexto: `useAuth`.
- CSS: `AccountPage.css`.

## Regras/validações
- Apagar conta pede confirmação via `window.confirm`.
- Depois de apagar, faz logout e redireciona para `/login`.

## Erros e estados vazios
- Mostra erro quando `delete-account` falha.

## Segurança e permissões
- Operação sensível: deve existir validação e autenticação no backend.

## Performance
- —

## Testabilidade
- —

## Notas
- —
