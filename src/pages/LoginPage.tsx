import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Banner, Loading } from "../components/ui";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../lib/demoClient";
import { isConfigured } from "../lib/supabase";

export function LoginPage() {
  const { ready, session, profile, profileState, blocked, signIn } = useAuth();
  const [email, setEmail] = useState(isConfigured ? "" : DEMO_EMAIL);
  const [password, setPassword] = useState(isConfigured ? "" : DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ready || (session && profileState === "loading")) return <Loading label="Comprobando la sesión…" />;
  if (session && profile) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const message = await signIn(email, password);
    setBusy(false);
    setError(message);
  }

  return (
    <section className="auth-screen">
      <div className="auth-copy">
        <p className="eyebrow">Fibcom Group S.A. · Chimaltenango</p>
        <h1>Panel de gestión IPTV</h1>
        <p>Cuentas, suscripciones, listas M3U y un historial de cada cambio. El personal entra con su correo; las líneas de los clientes se generan aparte.</p>
      </div>
      <form className="auth-card" onSubmit={(event) => void onSubmit(event)}>
        <h2>Ingresar</h2>
        {isConfigured ? null : <Banner kind="info">Vista previa. Usa {DEMO_EMAIL} y la contraseña {DEMO_PASSWORD}.</Banner>}
        {blocked ? <Banner kind="error">{blocked}</Banner> : null}
        {error ? <Banner kind="error">{error}</Banner> : null}
        <label className="field">
          <span>Correo</span>
          <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? "Ingresando…" : "Entrar"}</button>
      </form>
    </section>
  );
}
