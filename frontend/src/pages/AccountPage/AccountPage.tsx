/**
 * @file AccountPage.tsx
 * @module pages/AccountPage/AccountPage
 *
 * @summary
 *  - Página privada com definições de conta (perfil, sessão e ações sensíveis).
 *
 * @description
 *  - Mostra informação do utilizador autenticado (`useAuth().user`).
 *  - Permite terminar sessão (`useAuth().logout`).
 *  - Permite apagar a conta via endpoint `DELETE /auth/delete-account`.
 *
 * @dependencies
 *  - `useAuth()` (AuthContext): `user`, `logout`.
 *  - `api()` (services/api.ts): wrapper de fetch com auth/refresh.
 *  - `react-router-dom`: navegação para login após apagar conta.
 *
 * @security
 *  - Chamada `DELETE /auth/delete-account` é autenticada (`auth: true`).
 *  - Confirmação via `window.confirm` antes da ação irreversível.
 *
 * @errors
 *  - Erros do backend são mostrados em UI.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AccountPage.css";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

/**
 * Página de conta do utilizador.
 */
export function AccountPage() {
  const { user, logout } = useAuth();

  const [deleting, setDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const displayName = user?.name ?? user?.email ?? "Utilizador";

  /**
   * Apaga a conta do utilizador autenticado.
   *
   * @throws Error se o backend rejeitar (ex.: sessão inválida, erro interno).
   */
  async function handleDelete() {
    const confirmed = window.confirm(
      "Tens a certeza que queres apagar a tua conta? Esta ação é irreversível.",
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      await api("/auth/delete-account", { method: "DELETE", auth: true });
      await logout();
      navigate("/login", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message ?? "Não foi possível apagar a conta." : "Não foi possível apagar a conta.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="account">
      <header className="account__header">
        <p className="account__eyebrow">Conta</p>
        <h1 className="account__title">Definições de utilizador</h1>
        <p className="account__subtitle">
          Gere os dados da tua conta, sessão e ações sensíveis relacionadas com o teu perfil.
        </p>
      </header>

      <div className="account__grid">
        <section className="account-card">
          <h2 className="account-card__title">Perfil</h2>

          <p className="account-card__label">Nome</p>
          <p className="account-card__value">{displayName}</p>

          <p className="account-card__label">Email</p>
          <p className="account-card__value">{user?.email ?? "—"}</p>

          <p className="account-card__hint">
            Os dados do perfil são definidos no momento de registo. Futuras iterações da aplicação poderão permitir
            edição direta.
          </p>
        </section>

        <section className="account-card">
          <h2 className="account-card__title">Sessão</h2>
          <p className="account-card__text">
            A tua sessão está ativa neste dispositivo. Utiliza o botão abaixo para terminar sessão.
          </p>

          <button type="button" className="account-btn account-btn--secondary" onClick={() => logout()}>
            Terminar sessão
          </button>
        </section>

        <section className="account-card account-card--danger">
          <h2 className="account-card__title">Zona perigosa</h2>
          <p className="account-card__text">
            Apagar a conta remove definitivamente o teu utilizador e os dados associados. Esta operação não pode ser
            desfeita.
          </p>

          {error && (
            <p className="account-card__error" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            className="account-btn account-btn--danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "A apagar conta..." : "Apagar conta"}
          </button>
        </section>
      </div>
    </section>
  );
}
