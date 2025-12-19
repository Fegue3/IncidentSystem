/**
 * @file AppRoutes.tsx
 * @module routes/AppRoutes
 *
 * @summary
 *  - Definição central de rotas da aplicação (públicas e privadas) e guard de autenticação.
 *
 * @description
 *  - Este módulo define:
 *    - Rotas públicas: `/login`, `/signup`
 *    - Rotas privadas: todas as restantes (com layout `AppLayout`)
 *    - Guard `PrivateRoute` que bloqueia acesso sem `accessToken` e redireciona para login
 *      preservando o destino (`next`).
 *
 *  - Estrutura:
 *    - A rota privada “pai” aplica `PrivateRoute` + `AppLayout`.
 *    - As rotas internas são renderizadas via `<Outlet />` no `AppLayout`.
 *
 * @dependencies
 *  - `react-router-dom`:
 *    - `Routes/Route` para declarar rotas
 *    - `Navigate` para redirecionamentos
 *    - `useLocation` para capturar pathname + search (para `next`)
 *  - `useAuth` (`../context/AuthContext`) para verificar sessão (`accessToken`).
 *  - Pages e Layout importados para os respetivos `element`.
 *
 * @security
 *  - A proteção de rotas depende da presença de `accessToken` no `AuthContext`.
 *  - Isto melhora UX e evita navegação indevida, mas **não substitui** validação do backend.
 *  - Redirecionamento preserva o destino com query `next`, para pós-login voltar ao ecrã correto.
 *
 * @errors
 *  - Se o `AuthContext` não estiver montado (ex.: `AuthProvider` ausente), `useAuth()` pode falhar.
 *  - Rotas inválidas (`*`) são redirecionadas para `/`.
 *
 * @performance
 *  - Guard é simples e síncrono (apenas check de token).
 *  - Evitar lógica pesada no guard; validações detalhadas devem ser no backend / services.
 *
 * @example
 *  - Navegar para `/incidents/123` sem token -> redirect para `/login?next=%2Fincidents%2F123`.
 */

import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import LoginPage from "../pages/Auth/LoginPage/LoginPage";
import SignUpPage from "../pages/Auth/SignUpPage/SignUpPage";
import { useAuth } from "../context/AuthContext";

import { HomePage } from "../pages/HomePage/HomePage";
import { AppLayout } from "../layouts/AppLayout/AppLayout";
import { AccountPage } from "../pages/AccountPage/AccountPage";
import { IncidentCreatePage } from "../pages/Incidents/IncidentCreatePage";
import { IncidentDetailsPage } from "../pages/Incidents/IncidentDetailsPage";
import { TeamsPage } from "../pages/Teams/TeamsPage";
import { IntegrationsPage } from "../pages/Integrations/IntegrationsPage";
import { ReportsPage } from "../pages/Reports/ReportsPage";

/**
 * Guard de rotas privadas.
 *
 * Regras:
 * - Se não existir `accessToken`, redireciona para `/login` com query `next=<destino>`.
 * - Caso contrário, renderiza os children.
 *
 * @param children Conteúdo protegido (normalmente o `AppLayout` + rotas internas).
 */
function PrivateRoute({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const location = useLocation();

  if (!accessToken) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <>{children}</>;
}

/**
 * Declara o routing da aplicação.
 *
 * @returns Árvore de rotas (`Routes`) com:
 * - públicas (login/signup)
 * - privadas sob `PrivateRoute` + `AppLayout`
 * - fallback `*` -> `/`
 */
export default function AppRoutes() {
  return (
    <Routes>
      {/* públicas */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      {/* privadas */}
      <Route
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/incidents/new" element={<IncidentCreatePage />} />
        <Route path="/incidents/:id" element={<IncidentDetailsPage />} />
      </Route>

      {/* fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
