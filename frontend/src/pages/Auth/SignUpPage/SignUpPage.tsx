/**
 * @file SignUpPage.tsx
 * @module pages/Auth/SignUpPage/SignUpPage
 *
 * @summary
 *  - Página pública de registo (criação de conta).
 *
 * @description
 *  - Recolhe nome, email e password e chama `useAuth().register(...)`.
 *  - Suporta redirecionamento pós-registo via querystring `?next=/rota`.
 *
 * @dependencies
 *  - `useAuth()` (AuthContext): expõe `register(name, email, password)`.
 *  - `react-router-dom`: `useNavigate`, `useLocation`, `Link`.
 *  - `Auth.css`: estilos comuns do módulo Auth.
 *
 * @security
 *  - Não guarda tokens diretamente aqui; o AuthContext é responsável por persistência.
 *  - Valida apenas consistência de password (confirm), não faz validações fortes de password.
 *
 * @errors
 *  - Mostra mensagem de erro em UI se `register(...)` lançar erro.
 *
 * @example
 *  - /signup?next=/reports
 */

import type { FormEvent } from "react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import "../Auth.css";

/**
 * Página de registo.
 *
 * Regras:
 * - Password e confirmação têm de coincidir.
 * - Após sucesso, redireciona para `next` (default "/").
 */
export default function SignUpPage() {
  const { register } = useAuth();

  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirm, setConfirm] = useState<string>("");

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const navigate = useNavigate();
  const location = useLocation();

  const next = new URLSearchParams(location.search).get("next") || "/";

  /**
   * Submete o formulário de registo.
   *
   * @throws Error se o AuthContext lançar (ex.: email já existe, validações backend).
   */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);

    if (password !== confirm) {
      setError("As palavras-passe não coincidem");
      return;
    }

    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
      navigate(next, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message ?? "Falha no registo" : "Falha no registo");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-shell">
        <section className="auth-brand" aria-hidden="true">
          <p className="auth-brand__eyebrow">Incident Management System</p>
          <h1 className="auth-brand__title">Incident Manager</h1>
          <p className="auth-brand__text">
            Cria uma conta para começar a acompanhar incidentes, equipas e métricas em tempo real.
          </p>
          <ul className="auth-brand__highlights">
            <li>Fluxo Open → Investigating → Resolved</li>
            <li>Integrações com ferramentas de monitorização</li>
            <li>Relatórios e exportação de métricas</li>
          </ul>
        </section>

        <section className="auth-card" aria-label="Criar conta">
          <h2 className="auth-title">Criar conta</h2>
          <p className="auth-subtitle">Preenche os teus dados para começar a gerir incidentes.</p>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="field__label" htmlFor="name">
                Nome
              </label>
              <input
                id="name"
                className="field__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="field__input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="field__input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="confirm">
                Confirmar password
              </label>
              <input
                id="confirm"
                className="field__input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button className="button" type="submit" disabled={submitting}>
              {submitting ? "A criar..." : "Criar conta"}
            </button>
          </form>

          <div className="auth-footer">
            Já tens conta?{" "}
            <Link className="link" to={`/login?next=${encodeURIComponent(next)}`}>
              Entra aqui
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
