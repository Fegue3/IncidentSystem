/**
 * @file incidents.ts
 * @module services/incidents
 *
 * @summary
 *  - Tipos e API client para o domínio de Incident Management (listar, detalhe, criar, atualizar, comentários, status).
 *
 * @description
 *  - Este módulo define:
 *    - Tipos (Incident, Timeline, Comments, enums frontend)
 *    - Helpers de severidade (labels e ordenação)
 *    - Construção de query string para filtros
 *    - Funções de integração com endpoints `/incidents`
 *
 * @dependencies
 *  - `api()` do módulo `./api` para requests autenticados.
 *
 * @security
 *  - Todas as chamadas usam `auth:true` (requer sessão).
 *  - O backend é a autoridade final para permissões/scoping.
 *
 * @errors
 *  - Qualquer erro HTTP resulta em `Error` (lançado por `api()`).
 *  - Pages devem tratar loading/error states.
 *
 * @performance
 *  - `list()` suporta filtros via query string (reduz payload/latência quando usado corretamente).
 *  - Evitar re-fetch redundante nas Pages (ex.: memoização de filtros).
 */

import { api } from "./api";

/** Estados possíveis de um incidente (alinhado com o backend). */
export type IncidentStatus =
  | "NEW"
  | "TRIAGED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED";

/**
 * Severidade (SEV1–SEV4), igual ao enum Severity do backend.
 */
export type SeverityCode = "SEV1" | "SEV2" | "SEV3" | "SEV4";

/** Representação reduzida de utilizador para UI (listas, autor, owner, etc.). */
export type UserLite = {
  id: string;
  email: string;
  name?: string | null;
};

/** Representação reduzida de equipa para UI (dropdowns, tags). */
export type TeamLite = {
  id: string;
  name: string;
};

/** Representação reduzida de serviço primário associado ao incidente. */
export type ServiceLite = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  ownerTeam?: { id: string; name: string } | null;
};

/**
 * Modelo resumido de incidente (normalmente para listagens).
 */
export type IncidentSummary = {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;

  severity: SeverityCode;

  createdAt: string;

  reporter: UserLite;
  assignee?: UserLite | null;
  team?: TeamLite | null;

  primaryService?: ServiceLite | null;
};

/**
 * Tipos de evento de timeline.
 * Inclui união aberta para tolerar novos tipos vindos do backend sem quebrar o frontend.
 */
export type TimelineEventType =
  | "STATUS_CHANGE"
  | "COMMENT"
  | "FIELD_UPDATE"
  | "ASSIGNMENT"
  | (string & {});

/**
 * Evento da timeline de um incidente.
 *
 * @notes
 * - Inclui muitos campos opcionais para compatibilidade com payloads variáveis do backend.
 * - O frontend deve renderizar de forma defensiva (null/undefined safe).
 */
export type TimelineEvent = {
  id: string;
  createdAt: string;
  author?: UserLite | null;
  type: TimelineEventType;
  message?: string | null;
  fromStatus?: IncidentStatus | null;
  toStatus?: IncidentStatus | null;

  /**
   * ✅ Extras opcionais (backend pode mandar isto em updates)
   * Não rebenta nada se não vier.
   */
  changes?: unknown;
  diff?: unknown;
  payload?: unknown;
  data?: unknown;
  meta?: unknown;
  details?: unknown;

  assignee?: UserLite | null;
  owner?: UserLite | null;
  toAssignee?: UserLite | null;
  toOwner?: UserLite | null;

  toAssigneeId?: string | null;
  newAssigneeId?: string | null;
  assigneeId?: string | null;
  toOwnerId?: string | null;
  ownerId?: string | null;
  nextAssigneeId?: string | null;
  assignedToId?: string | null;

  toAssigneeName?: string | null;
  newAssigneeName?: string | null;
  toOwnerName?: string | null;
  newOwnerName?: string | null;

  toAssigneeEmail?: string | null;
  newAssigneeEmail?: string | null;
  toOwnerEmail?: string | null;
  newOwnerEmail?: string | null;
};

/** Comentário associado a um incidente. */
export type IncidentComment = {
  id: string;
  createdAt: string;
  author: UserLite;
  body: string;
};

/**
 * Modelo detalhado de incidente (normalmente para o ecrã de detalhe).
 */
export type IncidentDetails = IncidentSummary & {
  timeline: TimelineEvent[];
  comments: IncidentComment[];
};

/**
 * Parâmetros suportados para listagem com filtros.
 * Todos opcionais.
 */
export type ListIncidentsParams = {
  teamId?: string;
  status?: IncidentStatus;
  severity?: SeverityCode;
  assigneeId?: string;
  primaryServiceId?: string;
  primaryServiceKey?: string;
  search?: string;
};

/** Payload para criação de incidente. */
export type CreateIncidentInput = {
  title: string;
  description: string;
  severity: SeverityCode;
  teamId?: string;
  assigneeId?: string;
  primaryServiceId: string;
};

/**
 * Payload para atualização de campos base.
 *
 * @notes
 * - Permite `assigneeId: null` para remover owner/assignee.
 */
export type UpdateFieldsInput = {
  severity?: SeverityCode;

  /**
   * Permitir null para "Sem owner"
   */
  assigneeId?: string | null;
};

/** Payload para mudança de estado. */
export type ChangeStatusInput = {
  newStatus: IncidentStatus;
  message?: string;
};

/** Payload para criar comentário. */
export type AddCommentInput = {
  body: string;
};

/* ---------- Helpers de Severidade (SEV) ---------- */

/**
 * Ordem numérica de severidades para ordenações em UI.
 * (SEV1 = mais crítico).
 */
const SEVERITY_ORDER: Record<SeverityCode, number> = {
  SEV1: 1,
  SEV2: 2,
  SEV3: 3,
  SEV4: 4,
};

const SEVERITY_LABEL: Record<SeverityCode, string> = {
  SEV1: "SEV1 — Crítico",
  SEV2: "SEV2 — Alto",
  SEV3: "SEV3 — Médio",
  SEV4: "SEV4 — Baixo",
};

const SEVERITY_SHORT_LABEL: Record<SeverityCode, string> = {
  SEV1: "SEV1",
  SEV2: "SEV2",
  SEV3: "SEV3",
  SEV4: "SEV4",
};

/**
 * Devolve a prioridade (ordem) associada à severidade.
 *
 * @param code Código SEV.
 * @returns Número (menor = mais crítico). Se desconhecido, devolve 999.
 */
export function getSeverityOrder(code: SeverityCode): number {
  return SEVERITY_ORDER[code] ?? 999;
}

/**
 * Devolve a label “longa” para UI (ex.: "SEV1 — Crítico").
 *
 * @param code Código SEV.
 * @returns Label legível.
 */
export function getSeverityLabel(code: SeverityCode): string {
  return SEVERITY_LABEL[code] ?? code;
}

/**
 * Devolve a label curta para UI (ex.: "SEV2").
 *
 * @param code Código SEV.
 * @returns Label curta.
 */
export function getSeverityShortLabel(code: SeverityCode): string {
  return SEVERITY_SHORT_LABEL[code] ?? code;
}

/* ---------- helpers internos ---------- */

/**
 * Constrói query string para `list()` com base nos filtros fornecidos.
 *
 * @param params Filtros opcionais.
 * @returns String começando por "?" ou string vazia.
 */
function buildQuery(params: ListIncidentsParams): string {
  const qs = new URLSearchParams();
  if (params.teamId) qs.set("teamId", params.teamId);
  if (params.status) qs.set("status", params.status);
  if (params.severity) qs.set("severity", params.severity);
  if (params.assigneeId) qs.set("assigneeId", params.assigneeId);
  if (params.primaryServiceId)
    qs.set("primaryServiceId", params.primaryServiceId);
  if (params.primaryServiceKey)
    qs.set("primaryServiceKey", params.primaryServiceKey);
  if (params.search?.trim()) qs.set("search", params.search.trim());
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/* ---------- API ---------- */

/**
 * API client para endpoints de incidentes.
 *
 * @notes
 * - Todas as funções requerem `auth:true`.
 * - Errors são lançados por `api()` (tratar na Page).
 */
export const IncidentsAPI = {
  /**
   * Lista incidentes com filtros opcionais.
   *
   * @param params Filtros (teamId/status/severity/assignee/search/etc.).
   * @returns Lista de incidentes (summary).
   */
  async list(params: ListIncidentsParams = {}): Promise<IncidentSummary[]> {
    const result = await api(`/incidents${buildQuery(params)}`, { auth: true });
    return result as IncidentSummary[];
  },

  /**
   * Obtém detalhe completo de um incidente (inclui timeline e comentários).
   *
   * @param id Incident ID.
   * @returns Detalhes do incidente.
   */
  async get(id: string): Promise<IncidentDetails> {
    const result = await api(`/incidents/${id}`, { auth: true });
    return result as IncidentDetails;
  },

  /**
   * Cria um novo incidente.
   *
   * @param input Payload de criação.
   * @returns Incidente criado (normalmente inclui timeline/comentários vazios).
   */
  async create(input: CreateIncidentInput): Promise<IncidentDetails> {
    const result = await api(`/incidents`, {
      method: "POST",
      auth: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    return result as IncidentDetails;
  },

  /**
   * Altera o status de um incidente (e opcionalmente regista mensagem).
   *
   * @param id Incident ID.
   * @param input Payload de mudança de estado.
   * @returns Incidente atualizado.
   */
  async changeStatus(
    id: string,
    input: ChangeStatusInput,
  ): Promise<IncidentDetails> {
    const result = await api(`/incidents/${id}/status`, {
      method: "PATCH",
      auth: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    return result as IncidentDetails;
  },

  /**
   * Atualiza campos do incidente (ex.: severity, assignee).
   *
   * @param id Incident ID.
   * @param input Campos a atualizar.
   * @returns Incidente atualizado.
   */
  async updateFields(
    id: string,
    input: UpdateFieldsInput,
  ): Promise<IncidentDetails> {
    const result = await api(`/incidents/${id}`, {
      method: "PATCH",
      auth: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    return result as IncidentDetails;
  },

  /**
   * Adiciona comentário a um incidente.
   *
   * @param id Incident ID.
   * @param input Corpo do comentário.
   * @returns Comentário criado.
   */
  async addComment(id: string, input: AddCommentInput): Promise<IncidentComment> {
    const result = await api(`/incidents/${id}/comments`, {
      method: "POST",
      auth: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    return result as IncidentComment;
  },

  /**
   * Remove um incidente.
   *
   * @param id Incident ID.
   * @returns void.
   */
  async delete(id: string): Promise<void> {
    await api(`/incidents/${id}`, { method: "DELETE", auth: true });
  },
};
