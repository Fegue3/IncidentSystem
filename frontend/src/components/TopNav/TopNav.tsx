/**
 * @file TopNav.tsx
 * @module components/TopNav/TopNav
 *
 * @summary
 *  - Barra de navegação principal (links para as áreas privadas).
 *
 * @description
 *  - Usa `NavLink` para aplicar classe ativa consoante a rota atual.
 *  - Não faz controlo de acesso; assume que as rotas estão protegidas por `PrivateRoute`.
 *
 * @dependencies
 *  - `react-router-dom/NavLink`: estado `isActive` para estilo.
 *  - `TopNav.css`: estilos.
 */

import { NavLink } from "react-router-dom";
import "./TopNav.css";

/**
 * Navegação principal da aplicação.
 */
export function TopNav() {
  return (
    <nav className="topnav" aria-label="Navegação principal">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          isActive ? "topnav__link topnav__link--active" : "topnav__link"
        }
      >
        Dashboard
      </NavLink>

      <NavLink
        to="/reports"
        className={({ isActive }) =>
          isActive ? "topnav__link topnav__link--active" : "topnav__link"
        }
      >
        Relatórios
      </NavLink>

      <NavLink
        to="/teams"
        className={({ isActive }) =>
          isActive ? "topnav__link topnav__link--active" : "topnav__link"
        }
      >
        Equipas
      </NavLink>

      <NavLink
        to="/integrations"
        className={({ isActive }) =>
          isActive ? "topnav__link topnav__link--active" : "topnav__link"
        }
      >
        Integrações
      </NavLink>

      <NavLink
        to="/account"
        className={({ isActive }) =>
          isActive ? "topnav__link topnav__link--active" : "topnav__link"
        }
      >
        Conta
      </NavLink>
    </nav>
  );
}
