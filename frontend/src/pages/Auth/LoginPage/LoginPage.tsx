import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import "../Auth.css";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const navigate = useNavigate();
  const location = useLocation();
  const next = new URLSearchParams(location.search).get("next") || "/";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(next, { replace: true });
    } catch (err: unknown) {
      // 🔍 sem `any`, com type guard
      if (err instanceof Error) {
        setError(err.message ?? "Falha ao autenticar");
      } else {
        setError("Falha ao autenticar");
      }
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
            Monitora, investiga e resolve incidentes críticos com uma visão
            360º da tua infraestrutura.
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
