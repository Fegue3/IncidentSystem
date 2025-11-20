import { NavLink } from "react-router-dom";
import "./TopNav.css";

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
        to="/about"
        className={({ isActive }) =>
          isActive ? "topnav__link topnav__link--active" : "topnav__link"
        }
      >
        Sobre
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
