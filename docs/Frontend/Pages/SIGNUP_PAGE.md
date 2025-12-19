# SignUpPage (pages/Auth/SignUpPage/SignUpPage.tsx)

**Rota:** `/signup`

## Responsabilidade única
Registo de utilizador e redirecionamento para `next` após sucesso.

## UI/UX
- Form com nome, email, password e confirmação.
- Validação local de password = confirmação.
- Mensagens de erro.

## Estado local (principais)
- `name`, `email`, `password`, `confirm`
- `submitting` e `error`
- `next` lido de querystring

## APIs consumidas
- `useAuth().register(name, email, password)`

## Dependências
- React Router: `useNavigate`, `useLocation`, `Link`.
- Contexto: `useAuth`.
- CSS partilhado: `pages/Auth/Auth.css`.

## Regras/validações
- Valida que `password === confirm` antes de chamar o backend.
- Trim em `name` e `email` antes de enviar.

## Erros e estados vazios
- Mostra erro se passwords não coincidem ou se o backend rejeitar.

## Segurança e permissões
- Evitar leak de detalhes sensíveis em mensagens (deixar backend normalizar).

## Performance
- —

## Testabilidade
- —

## Notas
- —
