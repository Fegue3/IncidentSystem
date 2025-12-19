/**
 * @file AppLayout.tsx
 * @module layouts/AppLayout/AppLayout
 *
 * @summary
 *  - Layout base das rotas privadas (header + navegação + outlet).
 *
 * @description
 *  - Renderiza:
 *    - Header com branding e TopNav.
 *    - Conteúdo via `<Outlet />` (react-router-dom) para páginas filhas.
 *
 * @dependencies
 *  - `TopNav`: navegação principal (ex.: Home, Reports, Teams, Account, Logout).
 *  - `Outlet`: render de rotas aninhadas.
 *
 * @security
 *  - O controlo de acesso é feito fora (ex.: PrivateRoute em AppRoutes.tsx).
 */

import { Outlet } from "react-router-dom";
import { TopNav } from "../../components/TopNav/TopNav";
import "./AppLayout.css";

/**
 * Layout principal para áreas autenticadas.
 */
export function AppLayout() {
  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header__content">
          <div className="app-header__brand">
            <span className="app-title">Incident Manager</span>
            <span className="app-tagline">Monitorizar · Investigar · Resolver</span>
          </div>

          <TopNav />
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
