import { useEffect, useState } from "react";
import "./HomePage.css";
import { UsersAPI, type Me } from "../../services/users";

export function HomePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    UsersAPI.me()
      .then((data: Me) => {
        if (active) {
          setMe(data);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Erro a carregar perfil";
        if (active) setError(msg);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="home">
      <h1>Bem-vindo 👋</h1>
      {loading && <p>Carregar…</p>}
      {error && <p role="alert">{error}</p>}
      {me && <p>Olá, <strong>{me.name ?? me.email}</strong></p>}
      {!loading && !me && !error && <p>Não foi possível obter os teus dados.</p>}
      <p>Projeto React + Vite + TS minimalista.</p>
    </section>
  );
}