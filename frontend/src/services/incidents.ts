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

export type IncidentSummary = {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;

  /**
   * Campo de severidade (SEV1–SEV4).
   */
  severity: SeverityCode;

  createdAt: string;
  reporter: UserLite;
  assignee?: UserLite | null;
  team?: TeamLite | null;
};

export type TimelineEventType = "STATUS_CHANGE" | "COMMENT" | "FIELD_UPDATE";

export type TimelineEvent = {
  id: string;
  createdAt: string;
  author?: UserLite | null;
  type: TimelineEventType;
  message?: string | null;
  fromStatus?: IncidentStatus | null;
  toStatus?: IncidentStatus | null;
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
  // se mais tarde quiseres filtrar por severity/status/etc, acrescentas aqui
};

export type CreateIncidentInput = {
  title: string;
  description: string;

  /**
   * Severidade (SEV1–SEV4).
   */
  severity: SeverityCode;

  teamId?: string;

  /** Owner inicial opcional (assignee) */
  assigneeId?: string;
};

export type UpdateFieldsInput = {
  /** Atualizar severidade (SEV) */
  severity?: SeverityCode;

  /** Atualizar responsável (owner) */
  assigneeId?: string;
};

export type ChangeStatusInput = {
  newStatus: IncidentStatus;
  message?: string;
};

export type AddCommentInput = {
  body: string;
};

/* ---------- Helpers de Severidade (SEV) ---------- */

// ordem lógica: SEV1 mais crítico
const SEVERITY_ORDER: Record<SeverityCode, number> = {
  SEV1: 1,
  SEV2: 2,
  SEV3: 3,
  SEV4: 4,
};

// label longo para selects
const SEVERITY_LABEL: Record<SeverityCode, string> = {
  SEV1: "SEV1 — Crítico",
  SEV2: "SEV2 — Alto",
  SEV3: "SEV3 — Médio",
  SEV4: "SEV4 — Baixo",
};

// label curto para chips / badges
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
  const search = new URLSearchParams();
  if (params.teamId) search.set("teamId", params.teamId);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/* ---------- API ---------- */

export const IncidentsAPI = {
  async list(params: ListIncidentsParams = {}): Promise<IncidentSummary[]> {
    const result = await api(`/incidents${buildQuery(params)}`, {
      auth: true,
    });

    // Backend já devolve `severity`, por isso é só cast.
    return result as IncidentSummary[];
  },

  async get(id: string): Promise<IncidentDetails> {
    const result = await api(`/incidents/${id}`, {
      auth: true,
    });

    return result as IncidentDetails;
  },

  async create(input: CreateIncidentInput): Promise<IncidentDetails> {
    const result = await api(`/incidents`, {
      method: "POST",
      auth: true,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    return result as IncidentDetails;
  },

  async changeStatus(
    id: string,
    input: ChangeStatusInput
  ): Promise<IncidentDetails> {
    const result = await api(`/incidents/${id}/status`, {
      method: "PATCH",
      auth: true,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    return result as IncidentDetails;
  },

  /**
   * Atualiza campos genéricos (neste momento: severidade e/ou owner).
   */
  async updateFields(
    id: string,
    input: UpdateFieldsInput
  ): Promise<IncidentDetails> {
    const result = await api(`/incidents/${id}`, {
      method: "PATCH",
      auth: true,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    return result as IncidentDetails;
  },

  async addComment(
    id: string,
    input: AddCommentInput
  ): Promise<IncidentComment> {
    const result = await api(`/incidents/${id}/comments`, {
      method: "POST",
      auth: true,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    return result as IncidentComment;
  },

  async delete(id: string): Promise<void> {
    await api(`/incidents/${id}`, {
      method: "DELETE",
      auth: true,
    });
  },
};
