import { useMemo } from "react";
import "./IntegrationsPage.css";

type IntegrationId = "datadog" | "pagerduty" | "discord";

type IntegrationConfig = {
  id: IntegrationId;
  name: string;
  description: string;
  docsUrl?: string;
  notificationsEnabled: boolean;
};

export function IntegrationsPage() {
  const integrations = useMemo<IntegrationConfig[]>(
    () => [
      {
        id: "datadog",
        name: "Datadog",
        description: "Métricas, logs e APM em cloud.",
        docsUrl: "https://docs.datadoghq.com/",
        notificationsEnabled: true,
      },
      {
        id: "pagerduty",
        name: "PagerDuty",
        description: "Notificações on-call via eventos v2.",
        docsUrl: "https://support.pagerduty.com/",
        notificationsEnabled: true,
      },
      {
        id: "discord",
        name: "Discord",
        description: "Notificações via webhook (canal).",
        docsUrl:
          "https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks",
        notificationsEnabled: true,
      },
    ],
    []
  );

  return (
    <section className="integrations">
      <header className="integrations__header">
        <div>
          <p className="integrations__eyebrow">Conectores</p>
          <h1 className="integrations__title">Integrações com monitorização</h1>
          <p className="integrations__subtitle">
            Integrações nesta versão estão sempre ativas (sem configuração por utilizador).
          </p>
        </div>
      </header>

      <div className="integrations__grid integrations__grid--two">
        {integrations.map((item) => (
          <article key={item.id} className="integration-card integration-card--large">
            <header className="integration-card__header">
              <div>
                <p className="integration-card__eyebrow">Notificações</p>
                <h2 className="integration-card__title">{item.name}</h2>
                <p className="integration-card__desc">{item.description}</p>
              </div>

              <span className="badge-pill badge-pill--on">Ativas</span>
            </header>

            <div className="integration-card__row">
              <label className="switch" aria-label={`Enviar notificações (${item.name})`}>
                <input type="checkbox" checked={true} disabled />
                <span className="slider" />
              </label>

              <div className="integration-card__rowText">
                <div className="integration-card__hintTitle">Enviar notificações</div>
                <div className="integration-card__hint">
                  Sempre ativo nesta versão.
                </div>
              </div>
            </div>

            <div className="integration-card__body">
              <div className="integration-card__status-line">
                <span className="pill pill--on">Notificações ativas</span>
                <span className="integration-card__meta">
                  Configuração bloqueada
                </span>
              </div>

              {item.docsUrl ? (
                <div className="integration-card__actions">
                  <a
                    className="integration-btn integration-btn--ghost"
                    href={item.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver documentação
                  </a>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
