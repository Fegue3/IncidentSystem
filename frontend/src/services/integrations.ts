// frontend/src/services/integrations.ts
import { api } from "./api";

export type IntegrationId = "datadog" | "pagerduty" | "discord";

export type IntegrationConfig = {
  id: IntegrationId;
  name: string;
  description: string;
  docsUrl?: string;
  notificationsEnabled: boolean;
  lastSavedAt?: string | null;
};

export type IntegrationsState = Record<IntegrationId, IntegrationConfig>;

export const IntegrationsAPI = {
  async getMine(): Promise<IntegrationsState> {
    const raw = await api("/integrations/settings", { auth: true });
    return raw as IntegrationsState;
  },

  async setEnabled(
    id: IntegrationId,
    notificationsEnabled: boolean
  ): Promise<IntegrationsState> {
    const raw = await api(`/integrations/settings/${id}`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ notificationsEnabled }),
    });
    return raw as IntegrationsState;
  },
};
