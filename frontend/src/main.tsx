/**
 * @file main.tsx
 * @module main
 *
 * @summary
 *  - Entry point do frontend: monta a app React, injeta providers globais e ativa o router.
 *
 * @description
 *  - Este ficheiro inicializa a aplicação no elemento `#root` e define a árvore base:
 *    - `React.StrictMode` para validações adicionais em desenvolvimento.
 *    - `AuthProvider` para estado global de autenticação (sessão, user, tokens).
 *    - `BrowserRouter` para navegação client-side.
 *    - `AppRoutes` como “source of truth” das rotas.
 *
 * @dependencies
 *  - `react`, `react-dom/client`: bootstrap da app.
 *  - `react-router-dom` (`BrowserRouter`): routing SPA.
 *  - `./context/AuthContext` (`AuthProvider`): sessão/auth global.
 *  - `./routes/AppRoutes` (`AppRoutes`): definição de rotas/páginas.
 *  - `./index.css`: estilos globais + tokens do design system (CSS variables, reset, tipografia).
 *
 * @security
 *  - A árvore injeta `AuthProvider` no topo para permitir guards e UI condicional por sessão.
 *  - A autoridade final de permissões é sempre o backend; o frontend só melhora UX.
 *
 * @errors
 *  - Se `document.getElementById('root')` não existir, a app não monta (erro de runtime).
 *
 * @performance
 *  - `React.StrictMode` pode causar double-invocation de efeitos em DEV (comportamento esperado).
 *  - Providers globais aqui devem permanecer leves; lógica pesada deve ficar em páginas/serviços.
 *
 * @example
 *  - Normalmente não é importado por outros módulos; é executado pelo bundler (Vite) como entry.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppRoutes from "./routes/AppRoutes";
import "./index.css";

/**
 * Monta a aplicação React no DOM.
 *
 * Árvore base:
 * - StrictMode: validações extra em DEV.
 * - AuthProvider: contexto global de auth.
 * - BrowserRouter: routing SPA.
 * - AppRoutes: rotas/páginas.
 */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
);
