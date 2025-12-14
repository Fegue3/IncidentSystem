// frontend/src/services/incidents.ts
import { api } from "./api";

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

export type UserLite = {
  id: string;
  email: string;
  name?: string | null;
};

export type TeamLite = {
  id: string;
  name: string;
};

export type ServiceLite = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  ownerTeam?: { id: string; name: string } | null;
};

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

export type TimelineEventType =
  | "STATUS_CHANGE"
  | "COMMENT"
  | "FIELD_UPDATE"
  | "ASSIGNMENT"
  | (string & {});

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

export type IncidentComment = {
  id: string;
  createdAt: string;
  author: UserLite;
  body: string;
};

export type IncidentDetails = IncidentSummary & {
  timeline: TimelineEvent[];
  comments: IncidentComment[];
};

export type ListIncidentsParams = {
  teamId?: string;
  status?: IncidentStatus;
  severity?: SeverityCode;
  assigneeId?: string;
  primaryServiceId?: string;
  primaryServiceKey?: string;
  search?: string;
};

export type CreateIncidentInput = {
  title: string;
  description: string;
  severity: SeverityCode;
  teamId?: string;
  assigneeId?: string;
  primaryServiceId: string;
};

export type UpdateFieldsInput = {
  severity?: SeverityCode;

  /**
   * ✅ permitir null para "Sem owner"
   */
  assigneeId?: string | null;
};

export type ChangeStatusInput = {
  newStatus: IncidentStatus;
  message?: string;
};

export type AddCommentInput = {
  body: string;
};

/* ---------- Helpers de Severidade (SEV) ---------- */

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

export function getSeverityOrder(code: SeverityCode): number {
  return SEVERITY_ORDER[code] ?? 999;
}

export function getSeverityLabel(code: SeverityCode): string {
  return SEVERITY_LABEL[code] ?? code;
}

export function getSeverityShortLabel(code: SeverityCode): string {
  return SEVERITY_SHORT_LABEL[code] ?? code;
}

/* ---------- helpers internos ---------- */

function buildQuery(params: ListIncidentsParams): string {
  const qs = new URLSearchParams();
  if (params.teamId) qs.set("teamId", params.teamId);
  if (params.status) qs.set("status", params.status);
  if (params.severity) qs.set("severity", params.severity);
  if (params.assigneeId) qs.set("assigneeId", params.assigneeId);
  if (params.primaryServiceId) qs.set("primaryServiceId", params.primaryServiceId);
  if (params.primaryServiceKey) qs.set("primaryServiceKey", params.primaryServiceKey);
  if (params.search?.trim()) qs.set("search", params.search.trim());
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/* ---------- API ---------- */

export const IncidentsAPI = {
  async list(params: ListIncidentsParams = {}): Promise<IncidentSummary[]> {
    const result = await api(`/incidents${buildQuery(params)}`, { auth: true });
    return result as IncidentSummary[];
  },

  async get(id: string): Promise<IncidentDetails> {
    const result = await api(`/incidents/${id}`, { auth: true });
    return result as IncidentDetails;
  },

  async create(input: CreateIncidentInput): Promise<IncidentDetails> {
    const result = await api(`/incidents`, {
      method: "POST",
      auth: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    return result as IncidentDetails;
  },

  async changeStatus(id: string, input: ChangeStatusInput): Promise<IncidentDetails> {
    const result = await api(`/incidents/${id}/status`, {
      method: "PATCH",
      auth: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    return result as IncidentDetails;
  },

  async updateFields(id: string, input: UpdateFieldsInput): Promise<IncidentDetails> {
    const result = await api(`/incidents/${id}`, {
      method: "PATCH",
      auth: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    return result as IncidentDetails;
  },

  async addComment(id: string, input: AddCommentInput): Promise<IncidentComment> {
    const result = await api(`/incidents/${id}/comments`, {
      method: "POST",
      auth: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    return result as IncidentComment;
  },

  async delete(id: string): Promise<void> {
    await api(`/incidents/${id}`, { method: "DELETE", auth: true });
  },
};
