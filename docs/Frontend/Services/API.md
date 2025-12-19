# `src/services/api.ts`

## Overview
Cliente HTTP central do frontend. Fornece:
- wrapper `api()` para respostas JSON
- wrapper `apiBlob()` para downloads (CSV/PDF)
- gestão de sessão (`getAuth`, `setAuth`, `clearAuth`) via `localStorage`
- `Authorization: Bearer ...` quando `auth: true`
- refresh automático do token em `401` (1 tentativa por request)

## Porque existe
Centraliza comportamento transversal:
- parsing consistente de erros
- renovação de sessão
- headers e content-types corretos
- evita duplicação de lógica nas Pages

## Public API
- `getAuth(): AuthBag`
- `setAuth(bag: AuthBag): void`
- `clearAuth(): void`
- `api(path: string, options?: FetchOptions): Promise<unknown>`
- `apiBlob(path: string, options?: FetchOptions): Promise<Blob>`
- `AuthAPI.login(email: string, password: string): Promise<unknown>`
- `AuthAPI.register(name: string, email: string, password: string): Promise<unknown>`

### Tipos principais
- `AuthBag`: user + accessToken + refreshToken
- `FetchOptions`: `RequestInit` + `{ auth?: boolean; headers?: Record<string,string>; _retry?: boolean }`

## Data flow / lifecycle
1. `api()` prepara headers:
   - injeta `Authorization` se `auth:true`
   - injeta `Content-Type: application/json` apenas quando faz sentido (não em GET/HEAD e não para downloads)
2. Executa `fetch(API_BASE + path)`
3. Se `401` e `auth:true` e ainda não tentou `_retry`:
   - chama `/auth/refresh` com refresh token
   - se ok, atualiza tokens e repete o request uma vez
   - se falhar, `clearAuth()`
4. Faz parse do body:
   - JSON apenas quando `content-type` é `application/json`
5. Se `!res.ok`, lança `Error` com mensagem extraída

## Security & Access Control
- Tokens em `localStorage`:
  - pró: simples e persistente
  - contra: vulnerável a XSS (mitigar com CSP, sanitização, etc.)
- `auth:true` aplica Bearer token.
- `401` tenta refresh; falha limpa sessão.

## Errors & edge cases
- Erros HTTP lançam `Error`:
  - `message` do backend (se JSON)
  - fallback `HTTP <status>`
- `apiBlob()` tenta ler JSON ou texto para erro.
- Requests não-JSON retornam `null` em `api()` (por design).

## Performance notes
- Refresh só ocorre quando necessário (401).
- `_retry` evita loops infinitos.
- Content-Type condicionado evita problemas em downloads.

## Examples

### JSON request autenticado
```ts
import { api } from "./api";

const incidents = await api("/incidents", { auth: true });
```

### Download PDF/CSV
```ts
import { apiBlob } from "./api";

const blob = await apiBlob("/reports/export.pdf?from=2025-01-01", { auth: true });
const url = URL.createObjectURL(blob);
// depois: window.open(url) ou download via <a>
```

### Login e persistência
```ts
import { AuthAPI, setAuth } from "./api";

const res = await AuthAPI.login("a@b.com", "pass");
// setAuth({ user: res.user, accessToken: res.accessToken, refreshToken: res.refreshToken });
```

## Testabilidade
- Mockar `fetch` para testar:
  - injecção de headers
  - refresh em 401
  - parsing de erro `message`
- Mockar `localStorage` (jsdom) para `getAuth/setAuth/clearAuth`.
