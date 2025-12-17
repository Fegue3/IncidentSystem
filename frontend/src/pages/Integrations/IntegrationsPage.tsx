import { useEffect, useMemo, useState } from "react";
import "./IntegrationsPage.css";

const STORAGE_KEY = "integrations-settings-v2";

type IntegrationId = "datadog" | "pagerduty";

type IntegrationConfig = {
  id: IntegrationId;
  name: string;
  description: string;
  docsUrl?: string;

  // Só mantemos o que tu queres agora:
  notificationsEnabled: boolean;
  lastSavedAt?: string | null;
};

type StoredState = Record<IntegrationId, IntegrationConfig>;

const DEFAULTS: StoredState = {
  datadog: {
    id: "datadog",
    name: "Datadog",
    description: "Métricas, logs e APM em cloud.",
    docsUrl: "https://docs.datadoghq.com/",
    notificationsEnabled: false,
    lastSavedAt: null,
  },
  pagerduty: {
    id: "pagerduty",
    name: "PagerDuty",
    description: "Notificações on-call via eventos v2.",
    docsUrl: "https://support.pagerduty.com/",
    notificationsEnabled: false,
    lastSavedAt: null,
  },
};

function loadState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      ...DEFAULTS,
      ...(parsed as any),
    };
  } catch (err) {
    console.error("Failed to read integrations state", err);
    return DEFAULTS;
  }
}

function saveState(state: StoredState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function IntegrationsPage() {
  const [state, setState] = useState<StoredState>(() => loadState());
  const [saving, setSaving] = useState<IntegrationId | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("");

  useEffect(() => {
    saveState(state);
  }, [state]);

  const integrations = useMemo(() => [state.datadog, state.pagerduty], [state.datadog, state.pagerduty]);

  function updateIntegration(id: IntegrationId, updater: (cfg: IntegrationConfig) => IntegrationConfig) {
    setState((prev) => ({
      ...prev,
      [id]: updater(prev[id]),
    }));
  }

  function toggleNotifications(id: IntegrationId) {
    updateIntegration(id, (cfg) => ({
      ...cfg,
      notificationsEnabled: !cfg.notificationsEnabled,
    }));
    setStatusMsg("");
  }

  async function handleSave(id: IntegrationId) {
    setSaving(id);
    setStatusMsg("");
    // fake async só para UX
    await new Promise((resolve) => setTimeout(resolve, 350));

    updateIntegration(id, (cfg) => ({
      ...cfg,
      lastSavedAt: new Date().toISOString(),
    }));

    setSaving(null);
    const label = id === "pagerduty" ? "PagerDuty" : "Datadog";
    setStatusMsg(`${label}: preferências guardadas`);
  }

  return (
    <section className="integrations">
      <header className="integrations__header">
        <div>
          <p className="integrations__eyebrow">Conectores</p>
          <h1 className="integrations__title">Integrações com monitorização</h1>
          <p className="integrations__subtitle">
            Configura notificações para ferramentas externas. (Integrações completas desativadas nesta versão.)
          </p>
        </div>

        {statusMsg ? <div className="integrations__status">{statusMsg}</div> : null}
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

              <span className={`badge-pill ${item.notificationsEnabled ? "badge-pill--on" : "badge-pill--off"}`}>
                {item.notificationsEnabled ? "Ativas" : "Off"}
              </span>
            </header>

            <div className="integration-card__body">
              <div className="integration-card__row">
                <label className="switch" aria-label={`Enviar notificações (${item.name})`}>
                  <input
                    type="checkbox"
                    checked={item.notificationsEnabled}
                    onChange={() => toggleNotifications(item.id)}
                  />
                  <span className="slider" />
                </label>

                <div className="integration-card__rowText">
                  <div className="integration-card__hintTitle">Enviar notificações</div>
                  <div className="integration-card__hint">
                    Quando ativo, o sistema pode enviar eventos/avisos para {item.name}.
                  </div>
                </div>
              </div>

              <div className="integration-card__actions">
                <button
                  type="button"
                  className="integration-btn integration-btn--primary"
                  onClick={() => handleSave(item.id)}
                  disabled={saving === item.id}
                >
                  {saving === item.id ? "A guardar…" : "Guardar preferências"}
                </button>

                {item.docsUrl ? (
                  <a
                    className="integration-btn integration-btn--ghost"
                    href={item.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver documentação
                  </a>
                ) : null}
              </div>

              <div className="integration-card__status-line">
                <span className={`pill ${item.notificationsEnabled ? "pill--on" : "pill--off"}`}>
                  Notificações {item.notificationsEnabled ? "ativas" : "off"}
                </span>

                {item.lastSavedAt ? (
                  <span className="integration-card__meta">
                    Guardado em {new Date(item.lastSavedAt).toLocaleString()}
                  </span>
                ) : (
                  <span className="integration-card__meta">Ainda não guardado</span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
