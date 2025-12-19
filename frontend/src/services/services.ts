/**
 * @file services.ts
 * @module services/services
 *
 * @summary
 *  - API client para o catálogo de serviços (listar e obter por id).
 *
 * @description
 *  - Este módulo abstrai chamadas a `/services`.
 *  - Inclui suporte para filtro `isActive`.
 *
 * @dependencies
 *  - `api()` do módulo `./api`.
 *
 * @security
 *  - Requer autenticação (`auth:true`).
 *
 * @errors
 *  - Erros HTTP resultam em `Error` lançado por `api()`.
 *
 * @performance
 *  - `list(isActive)` permite reduzir payload quando só interessam serviços ativos/inativos.
 */

import { api } from "./api";

/** Representação reduzida de um Service para UI. */
export type ServiceLite = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  ownerTeam?: { id: string; name: string } | null;
};

export type ListServicesParams = {
  /** Se definido, filtra por serviços ativos/inativos. */
  isActive?: boolean;
};

/**
 * Constrói query string para listagem.
 *
 * @param params Parâmetros de filtro.
 * @returns Query string ou "".
 */
function buildQuery(params: ListServicesParams): string {
  const search = new URLSearchParams();
  if (params.isActive !== undefined) search.set("isActive", String(params.isActive));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/**
 * API client para endpoints de Services.
 */
export const ServicesAPI = {
  /**
   * Lista serviços (com filtro opcional `isActive`).
   *
   * @param params Filtros opcionais.
   * @returns Lista de serviços.
   */
  async list(params: ListServicesParams = {}): Promise<ServiceLite[]> {
    const raw = await api(`/services${buildQuery(params)}`, { auth: true });
    return raw as ServiceLite[];
  },

  /**
   * Obtém um serviço por id.
   *
   * @param id Service ID.
   * @returns Service.
   */
  async get(id: string): Promise<ServiceLite> {
    const raw = await api(`/services/${id}`, { auth: true });
    return raw as ServiceLite;
  },
};
