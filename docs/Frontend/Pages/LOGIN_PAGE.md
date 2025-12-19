# LoginPage (pages/Auth/LoginPage/LoginPage.tsx)

**Rota:** `/login`

## Responsabilidade única
Autenticação do utilizador (login) e redirecionamento para `next` após sucesso.

## UI/UX
- Form com email + password.
- Estado de loading no submit.
- Mensagens de erro amigáveis.

## Estado local (principais)
- `email`, `password`
- `submitting` (loading) e `error`
- `next` lido de querystring (`?next=`)

## APIs consumidas
- `useAuth().login(email, password)`

## Dependências
- React Router: `useNavigate`, `useLocation`, `Link`.
- Contexto: `useAuth`.
- CSS partilhado: `pages/Auth/Auth.css`.

## Regras/validações
- Trim no email antes de enviar.
- Password mínimo 6 caracteres (HTML validation).

## Erros e estados vazios
- Renderiza `error` se login falhar.

## Segurança e permissões
- Tokens são guardados via `AuthContext` + `services/api.ts`.
- Redirect seguro: o valor de `next` vem do router; evitar construir URLs externas.

## Performance
- —

## Testabilidade
- Unit: submit com passwords inválidas, mostra erro.
- Integration: mock do `useAuth.login` e valida redirecionamento.

## Notas
- —
