/**
 * @file LoginPage.tsx
 * @module pages/Auth/LoginPage/LoginPage
 *
 * @summary
 *  - Página pública de login.
 *
 * @description
 *  - Recolhe credenciais e chama `useAuth().login(email, password)`.
 *  - Suporta redirecionamento pós-login via querystring `?next=/rota`.
 *
 * @dependencies
 *  - `useAuth()` (AuthContext): expõe `login(email, password)`.
 *  - `react-router-dom`: `useNavigate`, `useLocation`, `Link`.
 *  - `Auth.css`: estilos comuns do módulo Auth.
 *
 * @security
 *  - Não persiste tokens aqui; responsabilidade do AuthContext.
 *
 * @errors
 *  - Mostra mensagem de erro em UI se `login(...)` lançar erro.
 */

import type { FormEvent } from "react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import "../Auth.css";

/**
 * Página de login.
 */
export default function LoginPage() {
  const { login } = useAuth();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const navigate = useNavigate();
  const location = useLocation();

  const next = new URLSearchParams(location.search).get("next") || "/";

  /**
   * Submete o formulário de login.
   *
   * @throws Error se o AuthContext lançar (ex.: credenciais inválidas / 401).
   */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(next, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message ?? "Falha ao autenticar" : "Falha ao autenticar");
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
            Monitora, investiga e resolve incidentes críticos com uma visão 360º da tua infraestrutura.
          </p>
          <ul className="auth-brand__highlights">
            <li>Prioridade por criticidade e impacto</li>
            <li>Timeline completa de cada incidente</li>
            <li>Registos e métricas num só lugar</li>
          </ul>
        </section>

        <section className="auth-card" aria-label="Iniciar sessão">
          <h2 className="auth-title">Iniciar sessão</h2>
          <p className="auth-subtitle">Acede com o teu e-mail e password.</p>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button className="button" type="submit" disabled={submitting}>
              {submitting ? "A entrar..." : "Entrar"}
            </button>
          </form>

          <div className="auth-footer">
            Não tens conta?{" "}
            <Link className="link" to={`/signup?next=${encodeURIComponent(next)}`}>
              Regista-te
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
