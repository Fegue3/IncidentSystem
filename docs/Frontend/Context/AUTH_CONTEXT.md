# AuthContext (context/AuthContext.tsx)

Contexto central de autenticação: guarda utilizador e tokens, e expõe ações `login/register/logout`.

## Responsabilidade única

- Manter o estado de auth (`user`, `accessToken`, `refreshToken`).
- Persistir automaticamente o estado no `localStorage` via helpers em `services/api.ts`.
- Disponibilizar um hook (`useAuth`) seguro para consumir o contexto.

## API pública

### Estado
- `user: { id; email; name? } | null`
- `accessToken: string | null`
- `refreshToken: string | null`

### Ações
- `login(email, password): Promise<void>`
- `register(name, email, password): Promise<void>`
- `logout(): void`

## Persistência

- Inicialização do estado usa `getAuth()` (lê `localStorage`).
- Sempre que `state` muda, `setAuth(state)` persiste no browser.
- `logout()` chama `clearAuth()` e limpa o estado em memória.

## Integração com refresh token

O refresh automático (em caso de 401) é feito em `services/api.ts` (não no contexto).  
Isto mantém o contexto simples e evita duplicação de lógica.

## Erros e invariantes

- `useAuth()` deve ser usado dentro do `<AuthProvider />`. Se não, lança `Error`.

## Notas de segurança

- Tokens em `localStorage` são convenientes, mas vulneráveis a XSS.  
  Mitigações recomendadas:
  - CSP (Content-Security-Policy)
  - Sanitização de inputs
  - Evitar `dangerouslySetInnerHTML`
  - Considerar cookies httpOnly (se o backend suportar)
