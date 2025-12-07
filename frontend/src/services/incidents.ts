import { api } from "./api";

export type IncidentStatus =
  | "NEW"
  | "TRIAGED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED";

export type Priority = "P1" | "P2" | "P3" | "P4";

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
  priority: Priority;
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
};

export type CreateIncidentInput = {
  title: string;
  description: string;
  priority: Priority;
  teamId?: string;
};

export type ChangeStatusInput = {
  newStatus: IncidentStatus;
  message?: string;
};

export type UpdateFieldsInput = {
  priority?: Priority;
};

export type AddCommentInput = {
  body: string;
};

function buildQuery(params: ListIncidentsParams): string {
  const search = new URLSearchParams();
  if (params.teamId) search.set("teamId", params.teamId);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const IncidentsAPI = {
  async list(params: ListIncidentsParams = {}): Promise<IncidentSummary[]> {
    const result = await api(`/incidents${buildQuery(params)}`, {
      auth: true,
    });

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
   * Atualiza campos genéricos do incidente (neste momento só prioridade).
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

  // --- NOVO: apagar incidente ---
  async delete(id: string): Promise<void> {
    await api(`/incidents/${id}`, {
      method: "DELETE",
      auth: true,
    });
  },
};
