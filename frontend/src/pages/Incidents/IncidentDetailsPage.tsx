// frontend/src/pages/Incidents/IncidentDetailsPage.tsx
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

type Params = {
  id: string;
};

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

function getTimelineDotClass(ev: TimelineEvent): string {
  if (ev.type !== "STATUS_CHANGE" || !ev.toStatus) {
    return "timeline__dot--neutral";
  }

  const s = ev.toStatus;

  if (s === "NEW" || s === "TRIAGED") {
    return "timeline__dot--open";
  }

  if (s === "IN_PROGRESS" || s === "ON_HOLD" || s === "REOPENED") {
    return "timeline__dot--active";
  }

  if (s === "RESOLVED" || s === "CLOSED") {
    return "timeline__dot--resolved";
  }

  return "timeline__dot--neutral";
}

function formatTimelineType(ev: TimelineEvent): string {
  if (ev.type === "FIELD_UPDATE") {
    // alteração genérica de campos – neste momento, severidade / owner
    return "SEVERITY_UPDATE";
  }
  return ev.type;
}

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

  const [selectedSeverity, setSelectedSeverity] =
    useState<SeverityCode | "">("");
  const [severityUpdating, setSeverityUpdating] = useState(false);
  const [severityError, setSeverityError] = useState<string | null>(null);

  const [newComment, setNewComment] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // owner/select de utilizadores
  const [availableOwners, setAvailableOwners] = useState<UserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [ownerUpdating, setOwnerUpdating] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");

  // ref para scroll automático da timeline para o fim
  const timelineRef = useRef<HTMLDivElement | null>(null);

  // função para voltar a carregar o incidente após updates
  async function refreshIncident(id: string) {
    try {
      const data = await IncidentsAPI.get(id);
      setIncident(data);
      setSelectedStatus("");
      setSelectedSeverity(data.severity);
    } catch (err) {
      console.error("Falha ao recarregar incidente", err);
    }
  }

  // carregar incidente inicial
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
        const msg =
          err instanceof Error
            ? err.message
            : "Não foi possível carregar o incidente.";
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

  // scroll para o fundo da timeline sempre que ela mudar
  useEffect(() => {
    if (!timelineRef.current) return;
    timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
  }, [incident?.timeline.length, timelineExpanded]);

  // quando o incidente muda, sincronizar selectedOwnerId
  useEffect(() => {
    if (!incident || !incident.assignee) {
      setSelectedOwnerId("");
    } else {
      setSelectedOwnerId(incident.assignee.id);
    }
  }, [incident?.assignee?.id]);

  // carregar membros da equipa (para dropdown de owner)
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

  const allowedNext = useMemo(
    () => (incident ? getAllowedNextStatuses(incident.status) : []),
    [incident]
  );

  const canDelete =
    !!incident && !!user && incident.reporter.id === user.id;

  // regras de permissões (reporter vs owner)
  const isReporter =
    !!incident && !!user && incident.reporter.id === user.id;
  const isOwner =
    !!incident && !!user && incident.assignee?.id === user.id;
  const hasOwner = !!incident?.assignee;

  // enquanto não há owner: só o reporter tem "controlo total"
  // depois de haver owner: só o owner atual tem controlo
  const canEditIncident =
    !!user && (!hasOwner ? isReporter : isOwner);

  const canManageOwner = canEditIncident;

  if (!incidentId) {
    return (
      <section className="incident-details">
        <p className="incident-details__error">
          ID de incidente inválido na rota.
        </p>
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
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível atualizar o estado.";
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

    try {
      await IncidentsAPI.updateFields(incident.id, {
        severity: selectedSeverity,
      });

      await refreshIncident(incident.id);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível atualizar a severidade.";
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
      await IncidentsAPI.addComment(incident.id, {
        body: newComment.trim(),
      });

      setNewComment("");
      await refreshIncident(incident.id);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível adicionar o comentário.";
      setCommentError(msg);
    } finally {
      setCommentSubmitting(false);
    }
  }

  // guardar responsável escolhido no dropdown
  async function handleSaveOwner() {
    if (!incident || !canManageOwner) return;

    setOwnerUpdating(true);
    setOwnerError(null);

    try {
      await IncidentsAPI.updateFields(incident.id, {
        assigneeId: selectedOwnerId || undefined,
      });

      await refreshIncident(incident.id);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível atualizar o responsável.";
      setOwnerError(msg);
    } finally {
      setOwnerUpdating(false);
    }
  }

  async function handleDeleteIncident() {
    if (!incident) return;
    const confirmed = window.confirm(
      "Tens a certeza que queres apagar este incidente? Esta ação é irreversível."
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await IncidentsAPI.delete(incident.id);
      navigate("/");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Não foi possível apagar o incidente.";
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

  return (
    <section className="incident-details">
      {/* topo */}
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

        <p className="incident-details__id">
          INCIDENTE #{incident.id.slice(0, 8).toUpperCase()}
        </p>

        <h1 className="incident-details__title">{incident.title}</h1>

        <div className="incident-details__chips">
          <span
            className={`chip chip--status chip--status-${incident.status.toLowerCase()}`}
          >
            {incident.status}
          </span>

          <span
            className={`chip chip--priority chip--priority-${incident.severity.toLowerCase()}`}
          >
            {getSeverityShortLabel(incident.severity)}
          </span>

          {incident.team && (
            <span className="incident-details__pill">
              Equipa: {incident.team.name}
            </span>
          )}
        </div>

        <p className="incident-details__subtitle">
          Reporter:{" "}
          <strong>{incident.reporter.name ?? incident.reporter.email}</strong>
          {incident.assignee && (
            <>
              {" · Responsável: "}
              <strong>
                {incident.assignee.name ?? incident.assignee.email}
              </strong>
            </>
          )}
        </p>

        {deleteError && (
          <p className="incident-details__error" role="alert">
            {deleteError}
          </p>
        )}
      </header>

      {/* gestão do incidente */}
      <section className="incident-manage">
        <h2 className="incident-manage__title">Gestão do incidente</h2>
        <p className="incident-manage__info">
          {hasOwner
            ? "Após ter responsável atribuído, apenas o owner pode alterar o estado, severidade e responsável."
            : "Enquanto não houver responsável, o reporter pode escolher o owner inicial e atualizar o incidente."}
        </p>

        <div className="incident-manage__grid">
          <form
            className="incident-form incident-form--status"
            onSubmit={handleStatusSubmit}
          >
            <label className="form-field">
              <span className="form-field__label">Alterar estado</span>
              <select
                className="form-field__select"
                value={selectedStatus}
                onChange={(e) =>
                  setSelectedStatus(e.target.value as IncidentStatus | "")
                }
                disabled={
                  allowedNext.length === 0 ||
                  statusUpdating ||
                  !canEditIncident
                }
              >
                {allowedNext.length === 0 && (
                  <option value="">
                    Nenhuma transição disponível a partir deste estado
                  </option>
                )}
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

            {statusError && (
              <p className="incident-details__error" role="alert">
                {statusError}
              </p>
            )}

            <button
              type="submit"
              className="incident-btn incident-btn--primary incident-form__submit"
              disabled={
                statusUpdating ||
                !selectedStatus ||
                allowedNext.length === 0 ||
                !canEditIncident
              }
            >
              {statusUpdating ? "A atualizar estado…" : "Atualizar estado"}
            </button>
          </form>

          <form
            className="incident-form incident-form--priority"
            onSubmit={handleSeveritySubmit}
          >
            <label className="form-field">
              <span className="form-field__label">Severidade (SEV)</span>
              <select
                className="form-field__select"
                value={selectedSeverity}
                onChange={(e) =>
                  setSelectedSeverity(e.target.value as SeverityCode | "")
                }
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
              disabled={
                severityUpdating || !selectedSeverity || !canEditIncident
              }
            >
              {severityUpdating
                ? "A guardar severidade…"
                : "Guardar severidade"}
            </button>

            {/* bloco de responsável */}
            <div className="incident-owner">
              {incident.team && canManageOwner && (
                <>
                  <label className="form-field incident-owner__select-field">
                    <span className="form-field__label-sm">
                      Selecionar responsável
                    </span>
                    <select
                      className="form-field__select"
                      value={selectedOwnerId}
                      onChange={(e) => setSelectedOwnerId(e.target.value)}
                      disabled={usersLoading || ownerUpdating}
                    >
                      <option value="">
                        Sem owner (incidente por atribuir)
                      </option>
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
                    {ownerUpdating
                      ? "A guardar responsável…"
                      : "Guardar responsável"}
                  </button>
                </>
              )}

              {incident.team && !canManageOwner && (
                <p className="incident-owner__hint">
                  Apenas o responsável atual pode alterar o owner.
                </p>
              )}

              {!incident.team && (
                <p className="incident-owner__hint">
                  Este incidente não está associado a nenhuma equipa, por isso
                  não é possível atribuir um responsável.
                </p>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* corpo principal: descrição + timeline + comentários */}
      <div className="incident-main">
        <section className="incident-panel incident-panel--main">
          <h2 className="incident-panel__title">Descrição</h2>
          <p className="incident-panel__text">{incident.description}</p>

          <h2 className="incident-panel__title incident-panel__title--mt">
            Timeline
          </h2>

          <div
            ref={timelineRef}
            className={
              "timeline-wrapper" +
              (timelineExpanded ? " timeline-wrapper--expanded" : "")
            }
          >
            <ol className="timeline">
              {incident.timeline.map((event) => {
                const renderedMessage = event.message ?? null;

                return (
                  <li key={event.id} className="timeline__item">
                    <div
                      className={
                        "timeline__dot " + getTimelineDotClass(event)
                      }
                    />
                    <div className="timeline__content">
                      <p className="timeline__meta">
                        <span className="timeline__time">
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                        {event.author && (
                          <>
                            {" · "}
                            <span className="timeline__author">
                              {event.author.name ?? event.author.email}
                            </span>
                          </>
                        )}
                        {" · "}
                        <span className="timeline__type">
                          {formatTimelineType(event)}
                        </span>
                      </p>

                      {renderedMessage && (
                        <p className="timeline__message">
                          {renderedMessage}
                        </p>
                      )}

                      {event.fromStatus && event.toStatus && (
                        <p className="timeline__status-change">
                          {event.fromStatus} → {event.toStatus}
                        </p>
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
              {timelineExpanded
                ? "Mostrar menos da timeline"
                : "Ver timeline completa"}
            </button>
          )}
        </section>

        <aside className="incident-panel incident-panel--side">
          <h2 className="incident-panel__title">Comentários</h2>

          <div className="comments__list-wrapper">
            {incident.comments.length === 0 && (
              <p className="incident-panel__text">
                Ainda não existem comentários neste incidente.
              </p>
            )}

            {incident.comments.length > 0 && (
              <ul className="comments comments__list">
                {incident.comments.map((comment) => (
                  <li key={comment.id} className="comments__item">
                    <div className="comments__header">
                      <span className="comments__author">
                        {comment.author.name ?? comment.author.email}
                      </span>
                      <span className="comments__time">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
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
              {commentSubmitting
                ? "A publicar comentário…"
                : "Publicar comentário"}
            </button>
          </form>
        </aside>
      </div>
    </section>
  );
}
