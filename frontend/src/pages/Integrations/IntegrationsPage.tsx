import { useEffect, useMemo, useState } from "react";
import "./IntegrationsPage.css";

const STORAGE_KEY = "integrations-settings";

type IntegrationId = "nagios" | "datadog" | "pagerduty";

type IntegrationConfig = {
  id: IntegrationId;
  name: string;
  description: string;
  docsUrl?: string;
  enabled: boolean;
  notificationsEnabled: boolean;
  apiKey: string;
  lastValidatedAt?: string | null;
};

type StoredState = Record<IntegrationId, IntegrationConfig>;

const DEFAULTS: StoredState = {
  nagios: {
    id: "nagios",
    name: "Nagios",
    description: "Monitorização e alertas on-prem.",
    docsUrl: "https://www.nagios.org/documentation/",
    enabled: false,
    notificationsEnabled: false,
    apiKey: "",
    lastValidatedAt: null,
  },
  datadog: {
    id: "datadog",
    name: "Datadog",
    description: "Métricas, logs e APM em cloud.",
    docsUrl: "https://docs.datadoghq.com/",
    enabled: false,
    notificationsEnabled: false,
    apiKey: "",
    lastValidatedAt: null,
  },
  pagerduty: {
    id: "pagerduty",
    name: "PagerDuty",
    description: "Notificações on-call via eventos v2.",
    docsUrl: "https://support.pagerduty.com/",
    enabled: false,
    notificationsEnabled: false,
    apiKey: "", // routing key
    lastValidatedAt: null,
  },
};

function loadState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as StoredState;
    return {
      ...DEFAULTS,
      ...parsed,
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

  const integrations = useMemo(
    () => [state.nagios, state.datadog, state.pagerduty],
    [state.nagios, state.datadog, state.pagerduty]
  );

  function updateIntegration(id: IntegrationId, updater: (cfg: IntegrationConfig) => IntegrationConfig) {
    setState((prev) => ({
      ...prev,
      [id]: updater(prev[id]),
    }));
  }

  async function handleToggle(id: IntegrationId) {
    updateIntegration(id, (cfg) => ({ ...cfg, enabled: !cfg.enabled }));
    setStatusMsg("");
  }

  async function handleNotifications(id: IntegrationId) {
    updateIntegration(id, (cfg) => ({ ...cfg, notificationsEnabled: !cfg.notificationsEnabled }));
    setStatusMsg("");
  }

  async function handleSave(id: IntegrationId, apiKey: string) {
    setSaving(id);
    setStatusMsg("");
    // Fake async validation just for UX feel
    await new Promise((resolve) => setTimeout(resolve, 400));
    updateIntegration(id, (cfg) => ({
      ...cfg,
      apiKey,
      lastValidatedAt: new Date().toISOString(),
    }));
    setSaving(null);
    const label = id === "pagerduty" ? "PagerDuty" : id.toUpperCase();
    setStatusMsg(`${label} guardado com sucesso`);
  }

  return (
    <section className="integrations">
      <header className="integrations__header">
        <div>
          <p className="integrations__eyebrow">Conectores</p>
          <h1 className="integrations__title">Integrações com monitorização</h1>
          <p className="integrations__subtitle">
            Liga o Incident Manager a ferramentas como Nagios ou Datadog para abrir incidentes automaticamente e opcionalmente enviar notificações.
          </p>
        </div>
        {statusMsg && <div className="integrations__status">{statusMsg}</div>}
      </header>

      <div className="integrations__grid">
        {integrations.map((item) => (
          <article key={item.id} className="integration-card">
            <header className="integration-card__header">
              <div>
                <p className="integration-card__eyebrow">Integração</p>
                <h2 className="integration-card__title">{item.name}</h2>
                <p className="integration-card__desc">{item.description}</p>
              </div>
              <label className="switch" aria-label={`Ativar integração ${item.name}`}>
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={() => handleToggle(item.id)}
                />
                <span className="slider" />
              </label>
            </header>

            <div className="integration-card__body">
              <label className="field">
                <span className="field__label">API Key</span>
                <input
                  className="field__input"
                  type="text"
                  value={item.apiKey}
                  onChange={(e) => updateIntegration(item.id, (cfg) => ({ ...cfg, apiKey: e.target.value }))}
                  placeholder="Introduce a API Key"
                  disabled={!item.enabled}
                />
              </label>

              <div className="integration-card__row">
                <label className="switch" aria-label="Enviar notificações">
                  <input
                    type="checkbox"
                    checked={item.notificationsEnabled}
                    onChange={() => handleNotifications(item.id)}
                    disabled={!item.enabled}
                  />
                  <span className="slider" />
                </label>
                <span className="integration-card__hint">Enviar notificações</span>
              </div>

              <div className="integration-card__actions">
                <button
                  type="button"
                  className="integration-btn"
                  onClick={() => handleSave(item.id, item.apiKey)}
                  disabled={!item.enabled || saving === item.id}
                >
                  {saving === item.id ? "A validar…" : "Guardar configuração"}
                </button>

                {item.docsUrl && (
                  <a className="integration-btn integration-btn--ghost" href={item.docsUrl} target="_blank" rel="noreferrer">
                    Ver documentação
                  </a>
                )}
              </div>

              <div className="integration-card__status-line">
                <span className={`pill ${item.enabled ? "pill--on" : "pill--off"}`}>
                  {item.enabled ? "Ligado" : "Desligado"}
                </span>
                <span className={`pill ${item.notificationsEnabled ? "pill--on" : "pill--off"}`}>
                  Notificações {item.notificationsEnabled ? "ativas" : "off"}
                </span>
                {item.lastValidatedAt && (
                  <span className="integration-card__meta">
                    Validado em {new Date(item.lastValidatedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
