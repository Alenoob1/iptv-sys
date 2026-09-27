import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { addDays, todayISO } from "../lib/format";
import { generatePassword, generateUsername } from "../lib/credentials";
import { humanError } from "../lib/rules";
import type { Client, Plan } from "../types";
import { Banner, Field } from "./ui";

export function CreateAccountModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [username, setUsername] = useState(generateUsername);
  const [password, setPassword] = useState(generatePassword);
  const [planId, setPlanId] = useState("");
  const [starts, setStarts] = useState(todayISO);
  const [ends, setEnds] = useState(() => addDays(todayISO(), 30));
  const [connections, setConnections] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([
      supabase.from("clients").select("*").order("name"),
      supabase.from("plans").select("*").eq("active", true).order("name"),
    ]).then(([clientResult, planResult]) => {
      const nextClients = (clientResult.data ?? []) as Client[];
      const nextPlans = (planResult.data ?? []) as Plan[];
      setClients(nextClients);
      setPlans(nextPlans);
      if (nextClients.length === 0) setMode("new");
      else setClientId(nextClients[0]?.id ?? "");
      const firstPlan = nextPlans[0];
      if (firstPlan) {
        setPlanId(firstPlan.id);
        setConnections(firstPlan.max_connections);
        setEnds(addDays(todayISO(), firstPlan.duration_days));
      }
    });
  }, []);

  function applyPlan(id: string, startDate = starts) {
    setPlanId(id);
    const plan = plans.find((item) => item.id === id);
    if (!plan) return;
    setConnections(plan.max_connections);
    setEnds(addDays(startDate, plan.duration_days));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (mode === "new" && name.trim().length < 2) {
      setError("Escribe el nombre del cliente.");
      return;
    }
    if (mode === "existing" && !clientId) {
      setError("Selecciona un cliente.");
      return;
    }
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("El correo del cliente no es válido.");
      return;
    }
    if (!planId) {
      setError("No hay un plan activo. Crea uno antes de generar la cuenta.");
      return;
    }
    setBusy(true);
    const { data, error: rpcError } = await supabase.rpc("create_iptv_account", {
      p_client_id: mode === "existing" ? clientId : null,
      p_new_client: mode === "new" ? { name: name.trim(), phone: phone.trim(), email: email.trim(), address: address.trim() } : null,
      p_username: username.trim(),
      p_password: password,
      p_plan_id: planId,
      p_starts: starts,
      p_ends: ends,
      p_connections: connections,
      p_notes: notes.trim(),
    });
    setBusy(false);
    if (rpcError) {
      setError(humanError(rpcError));
      return;
    }
    onCreated(String(data));
  }

  return (
    <form className="stack" onSubmit={(event) => void onSubmit(event)}>
      {error ? <Banner kind="error">{error}</Banner> : null}
      <div className="segmented">
        <button type="button" className={mode === "existing" ? "on" : ""} onClick={() => setMode("existing")} disabled={clients.length === 0}>
          Cliente existente
        </button>
        <button type="button" className={mode === "new" ? "on" : ""} onClick={() => setMode("new")}>
          Cliente nuevo
        </button>
      </div>
      {mode === "existing" ? (
        <Field label="Cliente">
          <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <div className="grid-2">
          <Field label="Nombre">
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <Field label="Teléfono">
            <input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
          <Field label="Correo">
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Dirección">
            <input value={address} onChange={(event) => setAddress(event.target.value)} />
          </Field>
        </div>
      )}
      <div className="grid-2">
        <Field label="Usuario de la línea">
          <input value={username} onChange={(event) => setUsername(event.target.value)} required />
        </Field>
        <Field label="Contraseña de la línea">
          <input value={password} onChange={(event) => setPassword(event.target.value)} required />
        </Field>
      </div>
      <button type="button" className="btn ghost" onClick={() => { setUsername(generateUsername()); setPassword(generatePassword()); }}>
        Generar otras credenciales
      </button>
      <div className="grid-2">
        <Field label="Plan">
          <select value={planId} onChange={(event) => applyPlan(event.target.value)}>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Conexiones">
          <input type="number" min={1} value={connections} onChange={(event) => setConnections(Number(event.target.value))} />
        </Field>
        <Field label="Inicio">
          <input type="date" value={starts} onChange={(event) => { setStarts(event.target.value); applyPlan(planId, event.target.value); }} />
        </Field>
        <Field label="Fin">
          <input type="date" value={ends} onChange={(event) => setEnds(event.target.value)} />
        </Field>
      </div>
      <Field label="Notas">
        <textarea value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      <div className="actions">
        <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn primary" disabled={busy}>{busy ? "Generando…" : "Generar cuenta"}</button>
      </div>
    </form>
  );
}
