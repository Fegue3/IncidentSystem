import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./IncidentDetailsPage.css";
import {
  IncidentsAPI,
  type IncidentDetails,
  type IncidentStatus,
  type SeverityCode,
  getSeverityLabel,
  getSeverityShortLabel,
} from "../../services/incidents";
import { useAuth } from "../../context/AuthContext";
import { TeamsAPI } from "../../services/teams";
import type { UserSummary } from "../../services/users";

type Params = { id: string };

function getAllowedNextStatuses(current: IncidentStatus): IncidentStatus[] {
  const map: Record<IncidentStatus, IncidentStatus[]> = {
    NEW: ["TRIAGED", "IN_PROGRESS"],
    TRIAGED: ["IN_PROGRESS", "ON_HOLD", "RESOLVED"],
    IN_PROGRESS: ["ON_HOLD", "RESOLVED"],
    ON_HOLD: ["IN_PROGRESS", "RESOLVED"],
    RESOLVED: ["CLOSED", "REOPENED"],
    CLOSED: ["REOPENED"],
    REOPENED: ["IN_PROGRESS", "ON_HOLD", "RESOLVED"],
  };
  return map[current] ?? [];
}

type TimelineEvent = IncidentDetails["timeline"][number];

/* -------------------------- helpers (sem any) -------------------------- */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function getRecordKey(obj: unknown, key: string): unknown {
  if (!isRecord(obj)) return undefined;
  return obj[key];
}

function getString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function normalizeSeverity(v: unknown): SeverityCode | null {
  const s = getString(v);
  if (!s) return null;
  const up = s.trim().toUpperCase();
  if (up === "SEV1" || up === "SEV2" || up === "SEV3" || up === "SEV4") return up as SeverityCode;
  return null;
}

function normalizeId(v: unknown): string | null {
  const s = getString(v);
  if (!s) return null;
  const t = s.trim();
  return t ? t : null;
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

function pickFirst(obj: unknown, keys: string[]): unknown {
  for (const k of keys) {
    const v = getRecordKey(obj, k);
    if (v !== undefined) return v;
  }
  return undefined;
}

function tryReadNested(obj: unknown, paths: string[][]): unknown {
  for (const path of paths) {
    let cur: unknown = obj;
    let ok = true;

    for (const key of path) {
      cur = getRecordKey(cur, key);
      if (cur === undefined) {
        ok = false;
        break;
      }
    }

    if (ok) return cur;
  }
  return undefined;
}

/** changes pode vir como objeto OU array */
type ChangeItem = { key: string; from?: unknown; to?: unknown };

function normalizeChanges(ev: unknown): ChangeItem[] {
  const out: ChangeItem[] = [];

  const changesLike =
    tryReadNested(ev, [
      ["changes"],
      ["diff"],
      ["payload", "changes"],
      ["data", "changes"],
      ["meta", "changes"],
      ["details", "changes"],
      ["details", "diff"],
    ]) ?? undefined;

  // 1) changes como { field: {from,to} }
  if (isRecord(changesLike)) {
    for (const key of Object.keys(changesLike)) {
      const item = changesLike[key];
      if (!isRecord(item)) continue;

      out.push({
        key,
        from: item["from"] ?? item["old"] ?? item["previous"] ?? item["fromValue"],
        to: item["to"] ?? item["new"] ?? item["next"] ?? item["toValue"] ?? item["value"],
      });
    }
    return out;
  }

  // 2) changes como array [{field, from, to}]
  if (Array.isArray(changesLike)) {
    for (const raw of changesLike) {
      if (!isRecord(raw)) continue;

      const key =
        getString(raw["field"]) ??
        getString(raw["key"]) ??
        getString(raw["name"]) ??
        getString(raw["property"]);

      if (!key) continue;

      out.push({
        key,
        from: raw["from"] ?? raw["old"] ?? raw["previous"] ?? raw["fromValue"],
        to: raw["to"] ?? raw["new"] ?? raw["next"] ?? raw["toValue"] ?? raw["value"],
      });
    }
  }

  return out;
}

/* -------------------------- classify helpers -------------------------- */

type SeverityChange = { from?: SeverityCode; to?: SeverityCode };
type OwnerChange = { toId?: string | null; toLabel?: string };
type GenericChange = { label: string; from?: string; to?: string };

function parseSeverityFromMessage(message: string): SeverityChange | null {
  const m = message.toUpperCase();
  const sevs = m.match(/SEV[1-4]/g);
  if (!sevs || sevs.length === 0) return null;

  if (sevs.length >= 2) {
    const from = normalizeSeverity(sevs[0]);
    const to = normalizeSeverity(sevs[sevs.length - 1]);
    if (from || to) return { from: from ?? undefined, to: to ?? undefined };
  }

  const only = normalizeSeverity(sevs[0]);
  if (only) return { to: only };
  return null;
}

function getSeverityChange(ev: TimelineEvent): SeverityChange | null {
  const obj: unknown = ev;

  // A) campos diretos
  const fromDirect = normalizeSeverity(pickFirst(obj, ["fromSeverity", "previousSeverity", "oldSeverity"]));
  const toDirect = normalizeSeverity(pickFirst(obj, ["toSeverity", "newSeverity", "severity"]));
  if ((fromDirect || toDirect) && fromDirect !== toDirect) {
    return { from: fromDirect ?? undefined, to: toDirect ?? undefined };
  }

  // B) field/key + from/to
  const field = getString(pickFirst(obj, ["field", "key"]));
  if (field?.toLowerCase() === "severity") {
    const fromVal = normalizeSeverity(pickFirst(obj, ["fromValue", "oldValue", "previousValue"]));
    const toVal = normalizeSeverity(pickFirst(obj, ["toValue", "newValue", "value"]));
    if ((fromVal || toVal) && fromVal !== toVal) {
      return { from: fromVal ?? undefined, to: toVal ?? undefined };
    }
  }

  // C) changes
  const changes = normalizeChanges(obj);
  const sev = changes.find((c) => c.key === "severity");
  if (sev) {
    const from = normalizeSeverity(sev.from);
    const to = normalizeSeverity(sev.to);
    if ((from || to) && from !== to) return { from: from ?? undefined, to: to ?? undefined };
  }

  // D) fallback por message
  const msg = getString(getRecordKey(obj, "message"));
  if (msg) {
    const parsed = parseSeverityFromMessage(msg);
    if (parsed) return parsed;
  }

  return null;
}

/** ✅ FIX: também lê "Responsável atualizado: NOME" da message */
function getOwnerChange(ev: TimelineEvent, labelById: Map<string, string>): OwnerChange | null {
  const obj: unknown = ev;

  const toId =
    normalizeId(
      pickFirst(obj, [
        "toAssigneeId",
        "newAssigneeId",
        "assigneeId",
        "toOwnerId",
        "ownerId",
        "nextAssigneeId",
        "assignedToId",
      ])
    ) ??
    normalizeId(
      tryReadNested(obj, [
        ["assignee", "id"],
        ["owner", "id"],
        ["toAssignee", "id"],
        ["toOwner", "id"],
      ])
    ) ??
    null;

  const toName =
    getString(pickFirst(obj, ["toAssigneeName", "newAssigneeName", "toOwnerName", "newOwnerName"])) ??
    getString(
      tryReadNested(obj, [
        ["assignee", "name"],
        ["owner", "name"],
        ["toAssignee", "name"],
        ["toOwner", "name"],
      ])
    ) ??
    null;

  const toEmail =
    getString(pickFirst(obj, ["toAssigneeEmail", "newAssigneeEmail", "toOwnerEmail", "newOwnerEmail"])) ??
    getString(
      tryReadNested(obj, [
        ["assignee", "email"],
        ["owner", "email"],
        ["toAssignee", "email"],
        ["toOwner", "email"],
      ])
    ) ??
    null;

  if (toId || toName || toEmail) {
    const label = toName ?? toEmail ?? (toId ? labelById.get(toId) : undefined);
    return { toId, toLabel: label ?? undefined };
  }

  const changes = normalizeChanges(obj);
  const ass = changes.find((c) => c.key === "assigneeId" || c.key === "ownerId");
  if (ass) {
    const id = normalizeId(ass.to) ?? null;
    const label = id ? labelById.get(id) : undefined;
    return { toId: id, toLabel: label ?? undefined };
  }

  const msg = getString(getRecordKey(obj, "message"));
  if (msg) {
    // 1) email no texto
    const email = msg.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
    if (email) return { toId: null, toLabel: email };

    // 2) nome no texto "Responsável atualizado: Fegue"
    const nameMatch =
      msg.match(/respons[aá]vel\s+(?:atualizado|alterado|atribu[ií]do)\s*:\s*(.+)$/i) ??
      msg.match(/owner\s+(?:updated|assigned)\s*:\s*(.+)$/i);

    if (nameMatch?.[1]) {
      const label = nameMatch[1].trim();
      if (label) return { toId: null, toLabel: label };
    }

    // 3) removido
    const removedMatch = msg.match(/respons[aá]vel\s+(?:removido|removida)\b/i) ?? msg.match(/owner\s+removed\b/i);
    if (removedMatch) return { toId: null, toLabel: "Sem owner" };
  }

  return null;
}

function isServiceEvent(ev: TimelineEvent): boolean {
  const msg = (ev.message ?? "").toLowerCase().trim();
  if (msg.startsWith("serviço definido") || msg.startsWith("servico definido")) return true;

  const changes = normalizeChanges(ev as unknown);
  return changes.some((c) => c.key === "primaryServiceId");
}

function getGenericFieldChanges(ev: TimelineEvent): GenericChange[] {
  if ((ev.fromStatus && ev.toStatus) || getSeverityChange(ev) || isServiceEvent(ev)) return [];

  const changes = normalizeChanges(ev as unknown);
  if (changes.length === 0) return [];

  const out: GenericChange[] = [];

  for (const c of changes) {
    if (c.key === "severity" || c.key === "assigneeId" || c.key === "ownerId") continue;

    const from = getString(c.from);
    const to = getString(c.to);
    if (!from && !to) continue;

    const label =
      c.key === "title" ? "Título" :
        c.key === "description" ? "Descrição" :
          c.key === "primaryServiceId" ? "Serviço" :
            c.key === "teamId" ? "Equipa" :
              c.key;

    out.push({
      label,
      from: from ? truncate(from, 70) : undefined,
      to: to ? truncate(to, 70) : undefined,
    });
  }

  return out.slice(0, 4);
}

type Kind = "STATUS" | "COMMENT" | "SEVERITY" | "OWNER" | "SERVICE" | "FIELDS" | "OTHER";

function getEventKind(
  ev: TimelineEvent,
  sev: SeverityChange | null,
  owner: OwnerChange | null,
  generic: GenericChange[]
): Kind {
  if (ev.type === "STATUS_CHANGE" || (ev.fromStatus && ev.toStatus)) return "STATUS";
  if (ev.type === "COMMENT") return "COMMENT";
  if (sev) return "SEVERITY";
  if (owner || ev.type === "ASSIGNMENT") return "OWNER";
  if (isServiceEvent(ev)) return "SERVICE";
  if (generic.length > 0 || ev.type === "FIELD_UPDATE" || String(ev.type).toUpperCase() === "FIELDS") return "FIELDS";
  return "OTHER";
}

function formatTimelineType(kind: Kind): string {
  if (kind === "STATUS") return "STATUS";
  if (kind === "COMMENT") return "COMMENT";
  if (kind === "SEVERITY") return "SEVERITY";
  if (kind === "OWNER") return "OWNER";
  if (kind === "SERVICE") return "SERVICE";
  if (kind === "FIELDS") return "FIELDS";
  return "EVENT";
}

/* -------------------------- dot + highlight -------------------------- */

function getTimelineDotClass(ev: TimelineEvent, kind: Kind, sev: SeverityChange | null): string {
  if (kind === "FIELDS" && ev.message) {
    const m = ev.message.toLowerCase();
    if (m.includes("ok")) return "timeline__dot--success";
    if (m.includes("fail")) return "timeline__dot--error";
  }
  if (kind === "STATUS" && ev.toStatus) {
    const s = ev.toStatus;
    if (s === "NEW" || s === "TRIAGED") return "timeline__dot--open";
    if (s === "IN_PROGRESS" || s === "ON_HOLD" || s === "REOPENED") return "timeline__dot--active";
    if (s === "RESOLVED" || s === "CLOSED") return "timeline__dot--resolved";
    return "timeline__dot--neutral";
  }

  if (kind === "SEVERITY") {
    const pivot = (sev?.to ?? sev?.from)?.toLowerCase();
    if (pivot === "sev1") return "timeline__dot--sev1";
    if (pivot === "sev2") return "timeline__dot--sev2";
    if (pivot === "sev3") return "timeline__dot--sev3";
    if (pivot === "sev4") return "timeline__dot--sev4";
    return "timeline__dot--severity";
  }

  if (kind === "OWNER") return "timeline__dot--owner";
  if (kind === "SERVICE") return "timeline__dot--service";
  if (kind === "COMMENT") return "timeline__dot--comment";
  return "timeline__dot--neutral";
}

function getChangeRowClass(kind: Kind, sev: SeverityChange | null): string {
  if (kind === "SEVERITY") {
    const pivot = (sev?.to ?? sev?.from)?.toLowerCase();
    if (pivot === "sev1") return "timeline__change-row timeline__change-row--sev1";
    if (pivot === "sev2") return "timeline__change-row timeline__change-row--sev2";
    if (pivot === "sev3") return "timeline__change-row timeline__change-row--sev3";
    if (pivot === "sev4") return "timeline__change-row timeline__change-row--sev4";
    return "timeline__change-row timeline__change-row--severity";
  }
  if (kind === "OWNER") return "timeline__change-row timeline__change-row--owner";
  if (kind === "SERVICE") return "timeline__change-row timeline__change-row--service";
  return "timeline__change-row";
}

/* -------------------------- FIX: hints para FIELD_UPDATE vazio -------------------------- */

type PendingHint =
  | { kind: "OWNER"; fromId: string | null; toId: string | null; startedAt: number }
  | { kind: "SEVERITY"; from: SeverityCode; to: SeverityCode; startedAt: number };

type Decoration = { kind: Kind; sev?: SeverityChange; owner?: OwnerChange };

function isEmptyFieldsEvent(ev: TimelineEvent): boolean {
  if (ev.fromStatus || ev.toStatus) return false;

  const t = String(ev.type).toUpperCase();
  if (t !== "FIELD_UPDATE" && t !== "FIELDS" && t !== "ASSIGNMENT") return false;

  const msg = (ev.message ?? "").trim().toLowerCase();
  if (msg && msg !== "campos atualizados") return false;

  const changes = normalizeChanges(ev as unknown);
  if (changes.length > 0) return false;

  return true;
}

/* --------------------------------- page --------------------------------- */

export function IncidentDetailsPage() {
  const params = useParams<Params>();
  const incidentId = params.id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [incident, setIncident] = useState<IncidentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const [timelineExpanded, setTimelineExpanded] = useState(false);

  const [selectedStatus, setSelectedStatus] = useState<IncidentStatus | "">("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [selectedSeverity, setSelectedSeverity] = useState<SeverityCode | "">("");
  const [severityUpdating, setSeverityUpdating] = useState(false);
  const [severityError, setSeverityError] = useState<string | null>(null);

  const [newComment, setNewComment] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // owner/select
  const [availableOwners, setAvailableOwners] = useState<UserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [ownerUpdating, setOwnerUpdating] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");

  const timelineRef = useRef<HTMLDivElement | null>(null);

  // ✅ FIX state
  const [pendingHint, setPendingHint] = useState<PendingHint | null>(null);
  const [decorations, setDecorations] = useState<Record<string, Decoration>>({});

  useEffect(() => {
    if (!timelineRef.current) return;
    timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
  }, [incident?.timeline?.length, timelineExpanded]);

  async function refreshIncident(id: string) {
    try {
      const data = await IncidentsAPI.get(id);

      if (pendingHint) {
        const candidates = [...(data.timeline ?? [])]
          .filter((ev) => isEmptyFieldsEvent(ev))
          .filter((ev) => (user?.id ? ev.author?.id === user.id : true))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const picked = candidates[0];

        if (picked) {
          if (pendingHint.kind === "SEVERITY") {
            setDecorations((prev) => ({
              ...prev,
              [picked.id]: { kind: "SEVERITY", sev: { from: pendingHint.from, to: pendingHint.to } },
            }));
          } else {
            setDecorations((prev) => ({
              ...prev,
              [picked.id]: {
                kind: "OWNER",
                owner: { toId: pendingHint.toId, toLabel: undefined },
              },
            }));
          }
        }

        setPendingHint(null);
      }

      setIncident(data);
      setSelectedStatus("");
      setSelectedSeverity(data.severity);
    } catch (err) {
      console.error("Falha ao recarregar incidente", err);
    }
  }

  useEffect(() => {
    if (!incidentId) return;

    let active = true;

    async function load(id: string) {
      setLoading(true);
      setLoadingError(null);

      try {
        const data = await IncidentsAPI.get(id);
        if (!active) return;

        setIncident(data);
        setSelectedStatus("");
        setSelectedSeverity(data.severity);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Não foi possível carregar o incidente.";
        if (active) setLoadingError(msg);
      } finally {
        if (active) setLoading(false);
      }
    }

    load(incidentId);

    return () => {
      active = false;
    };
  }, [incidentId]);

  const currentAssigneeId = incident?.assignee?.id ?? "";
  useEffect(() => {
    setSelectedOwnerId(currentAssigneeId);
  }, [currentAssigneeId]);

  useEffect(() => {
    const teamId = incident?.team?.id;
    if (!teamId) return;

    let active = true;
    setUsersLoading(true);
    setUsersError(null);

    TeamsAPI.listMembers(teamId)
      .then((data) => {
        if (!active) return;
        setAvailableOwners(data);
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof Error
            ? err.message
            : "Não foi possível carregar a lista de utilizadores para atribuir como owner.";
        if (active) setUsersError(msg);
      })
      .finally(() => {
        if (active) setUsersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [incident?.team?.id]);

  const incidentStatus = incident?.status;
  const allowedNext = useMemo(
    () => (incidentStatus ? getAllowedNextStatuses(incidentStatus) : []),
    [incidentStatus]
  );

  const canDelete = !!incident && !!user && incident.reporter.id === user.id;

  const isReporter = !!incident && !!user && incident.reporter.id === user.id;
  const isOwner = !!incident && !!user && incident.assignee?.id === user.id;
  const hasOwner = !!incident?.assignee;

  const canEditIncident = !!user && (!hasOwner ? isReporter : isOwner);
  const canManageOwner = canEditIncident;

  const reporter = incident?.reporter;
  const assignee = incident?.assignee;

  const userLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of availableOwners) m.set(u.id, u.name ?? u.email);
    if (reporter) m.set(reporter.id, reporter.name ?? reporter.email);
    if (assignee) m.set(assignee.id, assignee.name ?? assignee.email);
    return m;
  }, [
    availableOwners,
    reporter?.id, reporter?.name, reporter?.email,
    assignee?.id, assignee?.name, assignee?.email,
  ]);

  function renderUserLabel(id: string | null | undefined, fallback?: string) {
    if (fallback) return fallback;
    if (!id) return "Sem owner";
    return userLabelById.get(id) ?? `Utilizador ${id.slice(0, 8).toUpperCase()}`;
  }

  if (!incidentId) {
    return (
      <section className="incident-details">
        <p className="incident-details__error">ID de incidente inválido na rota.</p>
        <button
          type="button"
          className="incident-btn incident-btn--ghost incident-details__back-link"
          onClick={() => navigate(-1)}
        >
          ← Voltar
        </button>
      </section>
    );
  }

  function handleBack() {
    navigate(-1);
  }

  async function handleStatusSubmit(e: FormEvent) {
    e.preventDefault();
    if (!incident || !selectedStatus || !canEditIncident) return;

    setStatusUpdating(true);
    setStatusError(null);

    try {
      await IncidentsAPI.changeStatus(incident.id, {
        newStatus: selectedStatus,
        message: statusMessage || undefined,
      });

      setStatusMessage("");
      await refreshIncident(incident.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Não foi possível atualizar o estado.";
      setStatusError(msg);
    } finally {
      setStatusUpdating(false);
    }
  }

  async function handleSeveritySubmit(e: FormEvent) {
    e.preventDefault();
    if (!incident || !selectedSeverity || !canEditIncident) return;

    setSeverityUpdating(true);
    setSeverityError(null);

    setPendingHint({
      kind: "SEVERITY",
      from: incident.severity,
      to: selectedSeverity,
      startedAt: Date.now(),
    });

    try {
      await IncidentsAPI.updateFields(incident.id, { severity: selectedSeverity });
      await refreshIncident(incident.id);
    } catch (err: unknown) {
      setPendingHint(null);
      const msg = err instanceof Error ? err.message : "Não foi possível atualizar a severidade.";
      setSeverityError(msg);
    } finally {
      setSeverityUpdating(false);
    }
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!incident || !newComment.trim()) return;

    setCommentSubmitting(true);
    setCommentError(null);

    try {
      await IncidentsAPI.addComment(incident.id, { body: newComment.trim() });
      setNewComment("");
      await refreshIncident(incident.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Não foi possível adicionar o comentário.";
      setCommentError(msg);
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function handleSaveOwner() {
    if (!incident || !canManageOwner) return;

    setOwnerUpdating(true);
    setOwnerError(null);

    setPendingHint({
      kind: "OWNER",
      fromId: incident.assignee?.id ?? null,
      toId: selectedOwnerId ? selectedOwnerId : null,
      startedAt: Date.now(),
    });

    try {
      await IncidentsAPI.updateFields(incident.id, {
        assigneeId: selectedOwnerId ? selectedOwnerId : null,
      });

      await refreshIncident(incident.id);
    } catch (err: unknown) {
      setPendingHint(null);
      const msg = err instanceof Error ? err.message : "Não foi possível atualizar o responsável.";
      setOwnerError(msg);
    } finally {
      setOwnerUpdating(false);
    }
  }

  async function handleDeleteIncident() {
    if (!incident) return;
    const confirmed = window.confirm("Tens a certeza que queres apagar este incidente? Esta ação é irreversível.");
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await IncidentsAPI.delete(incident.id);
      navigate("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Não foi possível apagar o incidente.";
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <section className="incident-details">
        <p className="incident-details__status">A carregar incidente…</p>
      </section>
    );
  }

  if (loadingError || !incident) {
    return (
      <section className="incident-details">
        <p className="incident-details__error" role="alert">
          {loadingError ?? "Incidente não encontrado."}
        </p>
        <button
          type="button"
          className="incident-btn incident-btn--ghost incident-details__back-link"
          onClick={handleBack}
        >
          ← Voltar
        </button>
      </section>
    );
  }

  const isTimelineScrollable = incident.timeline.length > 4;

  const primaryService = (incident as unknown as { primaryService?: { name?: string; key?: string } | null })
    .primaryService;

  const serviceLabel = primaryService
    ? `${primaryService.name ?? "Serviço"}${primaryService.key ? ` (${primaryService.key})` : ""}`
    : "—";

  const headerOwnerLabel = incident.assignee
    ? (incident.assignee.name ?? incident.assignee.email)
    : "Sem owner";

  return (
    <section className="incident-details">
      <header className="incident-details__top">
        <div className="incident-details__top-bar">
          <button
            type="button"
            className="incident-btn incident-btn--ghost incident-details__back-link"
            onClick={handleBack}
          >
            ← Voltar
          </button>

          {canDelete && (
            <button
              type="button"
              className="incident-btn incident-btn--danger incident-details__delete-btn"
              onClick={handleDeleteIncident}
              disabled={deleting}
            >
              {deleting ? "A apagar…" : "Apagar incidente"}
            </button>
          )}
        </div>

        <p className="incident-details__id">INCIDENTE #{incident.id.slice(0, 8).toUpperCase()}</p>
        <h1 className="incident-details__title">{incident.title}</h1>

        <div className="incident-details__chips">
          <span className={`chip chip--status chip--status-${incident.status.toLowerCase()}`}>
            {incident.status}
          </span>

          <span className={`chip chip--severity chip--severity-${incident.severity.toLowerCase()}`}>
            {getSeverityShortLabel(incident.severity)}
          </span>

          {incident.team && <span className="incident-details__pill">Equipa: {incident.team.name}</span>}

          <span className="incident-details__pill incident-details__pill--service">
            Serviço: {serviceLabel}
          </span>
        </div>

        <p className="incident-details__subtitle">
          Reporter: <strong>{incident.reporter.name ?? incident.reporter.email}</strong>
          {" · Responsável: "}
          <strong>{headerOwnerLabel}</strong>
        </p>

        {deleteError && (
          <p className="incident-details__error" role="alert">
            {deleteError}
          </p>
        )}
      </header>

      <section className="incident-manage">
        <h2 className="incident-manage__title">Gestão do incidente</h2>
        <p className="incident-manage__info">
          {hasOwner
            ? "Após ter responsável atribuído, apenas o owner pode alterar o estado, severidade e responsável."
            : "Enquanto não houver responsável, o reporter pode escolher o owner inicial e atualizar o incidente."}
        </p>

        <div className="incident-manage__grid">
          {/* COLUNA ESQ: status + mensagem (acima) + botão (abaixo) */}
          <form className="incident-form incident-form--status" onSubmit={handleStatusSubmit}>
            <label className="form-field">
              <span className="form-field__label">Alterar estado</span>
              <select
                className="form-field__select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as IncidentStatus | "")}
                disabled={allowedNext.length === 0 || statusUpdating || !canEditIncident}
              >
                {allowedNext.length === 0 && <option value="">Nenhuma transição disponível a partir deste estado</option>}
                {allowedNext.length > 0 && (
                  <>
                    <option value="">Seleciona o próximo estado…</option>
                    {allowedNext.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </label>

            {statusError && (
              <p className="incident-details__error" role="alert">
                {statusError}
              </p>
            )}

            {/* ✅ mensagem em cima */}
            <label className="form-field incident-form__message-field">
              <span className="form-field__label">Mensagem (opcional)</span>
              <input
                type="text"
                className="form-field__input"
                placeholder="Ex.: Escalado para a equipa de base de dados"
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
                disabled={!canEditIncident}
              />
            </label>

            {/* ✅ botão em baixo */}
            <button
              type="submit"
              className="incident-btn incident-btn--primary incident-form__submit"
              disabled={statusUpdating || !selectedStatus || allowedNext.length === 0 || !canEditIncident}
            >
              {statusUpdating ? "A atualizar estado…" : "Atualizar estado"}
            </button>
          </form>

          {/* COLUNA DIR: severidade + owner */}
          <form className="incident-form incident-form--priority" onSubmit={handleSeveritySubmit}>
            <label className="form-field">
              <span className="form-field__label">Severidade (SEV)</span>
              <select
                className="form-field__select"
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value as SeverityCode | "")}
                disabled={severityUpdating || !canEditIncident}
              >
                <option value="SEV1">{getSeverityLabel("SEV1")}</option>
                <option value="SEV2">{getSeverityLabel("SEV2")}</option>
                <option value="SEV3">{getSeverityLabel("SEV3")}</option>
                <option value="SEV4">{getSeverityLabel("SEV4")}</option>
              </select>
            </label>

            {severityError && (
              <p className="incident-details__error" role="alert">
                {severityError}
              </p>
            )}

            <button
              type="submit"
              className="incident-btn incident-btn--ghost incident-form__submit"
              disabled={severityUpdating || !selectedSeverity || !canEditIncident}
            >
              {severityUpdating ? "A guardar severidade…" : "Guardar severidade"}
            </button>

            <div className="incident-owner">
              {incident.team && canManageOwner && (
                <>
                  <label className="form-field incident-owner__select-field">
                    <span className="form-field__label-sm">Selecionar responsável</span>
                    <select
                      className="form-field__select"
                      value={selectedOwnerId}
                      onChange={(e) => setSelectedOwnerId(e.target.value)}
                      disabled={usersLoading || ownerUpdating}
                    >
                      <option value="">Sem owner (incidente por atribuir)</option>
                      {availableOwners.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name ?? u.email}
                        </option>
                      ))}
                    </select>
                  </label>

                  {usersError && (
                    <p className="incident-details__error" role="alert">
                      {usersError}
                    </p>
                  )}

                  {ownerError && (
                    <p className="incident-details__error" role="alert">
                      {ownerError}
                    </p>
                  )}

                  <button
                    type="button"
                    className="incident-btn incident-btn--ghost incident-owner__btn"
                    onClick={handleSaveOwner}
                    disabled={ownerUpdating || usersLoading}
                  >
                    {ownerUpdating ? "A guardar responsável…" : "Guardar responsável"}
                  </button>
                </>
              )}

              {incident.team && !canManageOwner && (
                <p className="incident-owner__hint">Apenas o responsável atual pode alterar o owner.</p>
              )}

              {!incident.team && (
                <p className="incident-owner__hint">
                  Este incidente não está associado a nenhuma equipa, por isso não é possível atribuir um responsável.
                </p>
              )}
            </div>
          </form>
        </div>
      </section>

      <div className="incident-main">
        <section className="incident-panel incident-panel--main">
          <h2 className="incident-panel__title">Descrição</h2>
          <p className="incident-panel__text">{incident.description}</p>

          <h2 className="incident-panel__title incident-panel__title--mt">Timeline</h2>

          <div ref={timelineRef} className={"timeline-wrapper" + (timelineExpanded ? " timeline-wrapper--expanded" : "")}>
            <ol className="timeline">
              {incident.timeline.map((event) => {
                const deco = decorations[event.id];

                const sevChange = deco?.sev ?? getSeverityChange(event);
                const ownerChange = deco?.owner ?? getOwnerChange(event, userLabelById);
                const genericChanges = deco?.kind ? [] : getGenericFieldChanges(event);

                const kind = deco?.kind ?? getEventKind(event, sevChange, ownerChange, genericChanges);
                const typeLabel = formatTimelineType(kind);

                const msg = (event.message ?? "").trim();
                const showMsg = msg.length > 0 && msg.toLowerCase() !== "campos atualizados";

                return (
                  <li key={event.id} className="timeline__item">
                    <div className={"timeline__dot " + getTimelineDotClass(event, kind, sevChange)} />

                    <div className="timeline__content">
                      <p className="timeline__meta">
                        <span className="timeline__time">{new Date(event.createdAt).toLocaleString()}</span>
                        {event.author && (
                          <>
                            {" · "}
                            <span className="timeline__author">{event.author.name ?? event.author.email}</span>
                          </>
                        )}
                        {" · "}
                        <span className="timeline__type">{typeLabel}</span>
                      </p>

                      {showMsg && kind !== "FIELDS" && <p className="timeline__message">{msg}</p>}

                      {/* STATUS CHANGE */}
                      {event.fromStatus && event.toStatus && (
                        <p className={getChangeRowClass("STATUS", sevChange)}>
                          <span className="timeline__change-label">Estado:</span>
                          <span className={`chip chip--status chip--status-${event.fromStatus.toLowerCase()}`}>
                            {event.fromStatus}
                          </span>
                          <span className="timeline__arrow">→</span>
                          <span className={`chip chip--status chip--status-${event.toStatus.toLowerCase()}`}>
                            {event.toStatus}
                          </span>
                        </p>
                      )}

                      {/* SEVERITY */}
                      {kind === "SEVERITY" && sevChange && (sevChange.from || sevChange.to) && (
                        <p className={getChangeRowClass("SEVERITY", sevChange)}>
                          <span className="timeline__change-label">Severidade:</span>

                          {sevChange.from && (
                            <>
                              <span className={`chip chip--severity chip--severity-${sevChange.from.toLowerCase()}`}>
                                {getSeverityShortLabel(sevChange.from)}
                              </span>
                              <span className="timeline__arrow">→</span>
                            </>
                          )}

                          {sevChange.to && (
                            <span className={`chip chip--severity chip--severity-${sevChange.to.toLowerCase()}`}>
                              {getSeverityShortLabel(sevChange.to)}
                            </span>
                          )}
                        </p>
                      )}

                      {/* OWNER */}
                      {kind === "OWNER" && (
                        <p className={getChangeRowClass("OWNER", sevChange)}>
                          <span className="timeline__change-label">Responsável:</span>
                          <span
                            className={
                              "timeline__user-badge" + (!ownerChange?.toId ? " timeline__user-badge--none" : "")
                            }
                          >
                            {renderUserLabel(ownerChange?.toId ?? null, ownerChange?.toLabel)}
                          </span>
                        </p>
                      )}

                      {/* FIELDS genéricos */}
                      {kind === "FIELDS" && genericChanges.length > 0 && (
                        <ul className="timeline__kv">
                          {genericChanges.map((c, idx) => (
                            <li key={idx} className="timeline__kv-item">
                              <span className="timeline__kv-key">{c.label}:</span>
                              <span className="timeline__kv-val">{c.from ? `“${c.from}”` : "—"}</span>
                              <span className="timeline__kv-arrow">→</span>
                              <span className="timeline__kv-val">{c.to ? `“${c.to}”` : "—"}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {kind === "FIELDS" && genericChanges.length === 0 && showMsg && (
                        <p className="timeline__message">{msg}</p>
                      )}

                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {isTimelineScrollable && (
            <button
              type="button"
              className="incident-btn incident-btn--ghost incident-timeline-toggle"
              onClick={() => setTimelineExpanded((v) => !v)}
            >
              {timelineExpanded ? "Mostrar menos da timeline" : "Ver timeline completa"}
            </button>
          )}
        </section>

        <aside className="incident-panel incident-panel--side">
          <h2 className="incident-panel__title">Comentários</h2>

          <div className="comments__list-wrapper">
            {incident.comments.length === 0 && (
              <p className="incident-panel__text">Ainda não existem comentários neste incidente.</p>
            )}

            {incident.comments.length > 0 && (
              <ul className="comments comments__list">
                {incident.comments.map((comment) => (
                  <li key={comment.id} className="comments__item">
                    <div className="comments__header">
                      <span className="comments__author">{comment.author.name ?? comment.author.email}</span>
                      <span className="comments__time">{new Date(comment.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="comments__body">{comment.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form className="comments__form" onSubmit={handleAddComment}>
            <label className="form-field">
              <span className="form-field__label">Novo comentário</span>
              <textarea
                className="form-field__textarea"
                rows={3}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Adiciona contexto, decisões ou resultados de testes…"
              />
            </label>

            {commentError && (
              <p className="incident-details__error" role="alert">
                {commentError}
              </p>
            )}

            <button
              type="submit"
              className="incident-btn incident-btn--primary comments__btn"
              disabled={commentSubmitting || !newComment.trim()}
            >
              {commentSubmitting ? "A publicar comentário…" : "Publicar comentário"}
            </button>
          </form>
        </aside>
      </div>
    </section>
  );
}
