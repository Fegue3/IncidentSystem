import { useEffect, useState } from "react";
import "./HomePage.css";
import { UsersAPI, type Me } from "../../services/users";

export function HomePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    UsersAPI.me()
      .then((data: Me) => {
        if (active) {
          setMe(data);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        const msg =
          e instanceof Error ? e.message : "Erro a carregar o teu perfil";
        if (active) setError(msg);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const displayName = me?.name ?? me?.email ?? "Operador";

  return (
    <section className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">Incident Manager</p>
          <h1 className="dashboard__title">Visão geral dos incidentes</h1>
          <p className="dashboard__subtitle">
            {me
              ? `Bem-vindo, ${displayName}. Acompanha o ciclo de vida dos incidentes em tempo real.`
              : "Acompanha o ciclo de vida dos incidentes em tempo real."}
          </p>
        </div>

        <div className="dashboard__actions">
          <button className="dashboard-btn dashboard-btn--ghost" type="button">
            Atualizar
          </button>
          <button
            className="dashboard-btn dashboard-btn--primary"
            type="button"
          >
            Novo incidente
          </button>
        </div>
      </header>

      <div className="dashboard__status-area">
        {loading && <p className="dashboard__status">A carregar dados…</p>}

        {error && (
          <p className="dashboard__status dashboard__status--error" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && !me && (
          <p className="dashboard__status">
            Não foi possível obter os teus dados neste momento.
          </p>
        )}
      </div>

      <section
        className="dashboard__columns"
        aria-label="Resumo por estado do incidente"
      >
        <article className="incident-column incident-column--open">
          <header className="incident-column__header">
            <h2 className="incident-column__title">Open</h2>
            <span className="incident-column__badge">0</span>
          </header>
          <p className="incident-column__hint">
            Sem incidentes abertos neste momento. Mantém os olhos nos alertas
            para reagir rápido a novas falhas.
          </p>
        </article>

        <article className="incident-column incident-column--investigating">
          <header className="incident-column__header">
            <h2 className="incident-column__title">Investigating</h2>
            <span className="incident-column__badge">0</span>
          </header>
          <p className="incident-column__hint">
            Quando um incidente é atribuído à equipa, ele aparece aqui até ser
            resolvido.
          </p>
        </article>

        <article className="incident-column incident-column--resolved">
          <header className="incident-column__header">
            <h2 className="incident-column__title">Resolved</h2>
            <span className="incident-column__badge">0</span>
          </header>
          <p className="incident-column__hint">
            Os incidentes resolvidos ficam registados para consulta de histórico
            e relatórios.
          </p>
        </article>
      </section>
    </section>
  );
}
