import { Outlet } from "react-router-dom";
import { TopNav } from "../../components/TopNav/TopNav";
import "./AppLayout.css";

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
