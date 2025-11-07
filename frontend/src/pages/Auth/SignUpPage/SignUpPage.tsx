import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import "../Auth.css";
import "./SignUpPage.css";

export default function SignUpPage() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const navigate = useNavigate();
  const location = useLocation();
  const next = new URLSearchParams(location.search).get("next") || "/";

  async function handleSubmit(e: React.FormEvent) {
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
    } catch (err: any) {
      setError(err.message ?? "Falha no registo");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Criar conta</h1>
        <p className="auth-subtitle">Preenche os teus dados para começar.</p>

        {error && <div className="form-error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="field__label" htmlFor="name">Nome</label>
            <input id="name" className="field__input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="email">Email</label>
            <input id="email" className="field__input" type="email" autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="password">Password</label>
            <input id="password" className="field__input" type="password" autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="confirm">Confirmar password</label>
            <input id="confirm" className="field__input" type="password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
          </div>

          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "A criar..." : "Criar conta"}
          </button>
        </form>

        <div className="auth-footer">
          Já tens conta?{" "}
          <Link className="link" to={`/login?next=${encodeURIComponent(next)}`}>Entra aqui</Link>
        </div>
      </div>
    </div>
  );
}