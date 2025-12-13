import { api } from "./api";

export type ServiceLite = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  ownerTeam?: { id: string; name: string } | null;
};

export type ListServicesParams = {
  isActive?: boolean;
};

function buildQuery(params: ListServicesParams): string {
  const search = new URLSearchParams();
  if (params.isActive !== undefined) search.set("isActive", String(params.isActive));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const ServicesAPI = {
  async list(params: ListServicesParams = {}): Promise<ServiceLite[]> {
    const raw = await api(`/services${buildQuery(params)}`, { auth: true });
    return raw as ServiceLite[];
  },

  async get(id: string): Promise<ServiceLite> {
    const raw = await api(`/services/${id}`, { auth: true });
    return raw as ServiceLite;
  },
};
