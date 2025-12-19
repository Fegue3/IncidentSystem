# Setup local do Frontend

Este documento cobre apenas o **frontend** (Vite + React + TypeScript).  
O backend deve estar a correr para autenticação e consumo de dados.

## Pré‑requisitos

- Node.js 18+
- npm (incluído no Node)
- Backend/API a correr (por defeito: `http://localhost:3000/api`)

## Estrutura esperada (alto nível)

- `frontend/` – aplicação React (Vite)
- `docs/` – documentação do projeto (fora de backend/frontend)

## Variáveis de ambiente

Cria `frontend/.env` (ou copia de `.env.example`) e garante:

```bash
VITE_API_URL=http://localhost:3000/api
```

> Nota: o código usa `import.meta.env.VITE_API_URL` e faz fallback para `http://localhost:3000/api`.

## Instalar dependências

```bash
cd frontend
npm ci
```

Se não existir `package-lock.json`:

```bash
npm install
```

## Arrancar em modo dev

```bash
npm run dev
```

Por defeito:

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000/api`

## Build e preview

```bash
npm run build
npm run preview
```

## Como a autenticação funciona (resumo)

- O estado de auth vive em `context/AuthContext.tsx`.
- Tokens são persistidos em `localStorage` pela camada `services/api.ts`.
- Requests autenticadas usam `Authorization: Bearer <accessToken>`.
- Em 401, a camada `services/api.ts` tenta refresh automático via `/auth/refresh`.

## Troubleshooting rápido

### Frontend não liga ao backend
- Confirma `VITE_API_URL` (inclui `/api`).
- Confirma CORS no backend para origem do Vite (ex.: `http://localhost:5173`).

### Logout “não limpa”
- O logout é local (limpa `localStorage`). Se precisares de revogar tokens server-side, adiciona endpoint no backend e chama-o no `logout()`.
