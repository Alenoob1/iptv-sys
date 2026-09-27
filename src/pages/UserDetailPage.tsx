import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Banner, Empty, Field, Loading, Modal, PageHead, StatusBadge } from "../components/ui";
import { copyText, generatePassword, playlistUrl } from "../lib/credentials";
import { formatDate } from "../lib/format";
import { downloadText, fetchChannelsForPlan } from "../lib/playlists";
import { toM3u } from "../lib/m3u";
import { humanError, nextSubStatuses, nextUserStatuses } from "../lib/rules";
import { supabase } from "../lib/supabase";
import type { DirectoryRow, Plan, SubStatus, Subscription, UserStatus } from "../types";

export function UserDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const created = Boolean((location.state as { created?: boolean } | null)?.created);
  const [row, setRow] = useState<DirectoryRow | null>(null);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [planId, setPlanId] = useState("");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [connections, setConnections] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(created ? "Cuenta generada. Entrega estas credenciales solo al cliente." : null);
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<{ status: UserStatus; label: string; warning: string } | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    const [directory, subscriptions, planRows] = await Promise.all([
      supabase.from("iptv_directory").select("*").eq("id", id).maybeSingle(),
      supabase.from("subscriptions").select("*").eq("iptv_user_id", id).order("created_at", { ascending: false }),
      supabase.from("plans").select("*").order("name"),
    ]);
    setLoading(false);
    const failed = [directory, subscriptions, planRows].find((result) => result.error);
    if (failed?.error) {
      setError(humanError(failed.error));
      return;
    }
    const next = (directory.data ?? null) as DirectoryRow | null;
    const nextSubs = (subscriptions.data ?? []) as Subscription[];
    setRow(next);
    setSubs(nextSubs);
    setPlans((planRows.data ?? []) as Plan[]);
    setNotes(next?.notes ?? "");
    const current = nextSubs[0];
    if (current) {
      setSelected(current.id);
      setPlanId(current.plan_id);
      setStarts(current.starts_at);
      setEnds(current.ends_at);
      setConnections(current.max_connections);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  function choose(sub: Subscription) {
    setSelected(sub.id);
    setPlanId(sub.plan_id);
    setStarts(sub.starts_at);
    setEnds(sub.ends_at);
    setConnections(sub.max_connections);
  }

  async function copy(label: string, value: string) {
    await copyText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1500);
  }

  async function saveNotes() {
    if (!row) return;
    setBusy(true);
    const result = await supabase.from("iptv_users").update({ notes: notes.trim() || null }).eq("id", row.id);
    setBusy(false);
    if (result.error) setError(humanError(result.error));
    else setNotice("Notas guardadas.");
  }

  async function resetPassword() {
    if (!row) return;
    const next = generatePassword();
    setBusy(true);
    const result = await supabase.from("iptv_users").update({ line_password: next }).eq("id", row.id);
    setBusy(false);
    if (result.error) {
      setError(humanError(result.error));
      return;
    }
    setRow({ ...row, line_password: next });
    setNotice("Nueva contraseña de línea generada.");
  }

  async function applyStatus() {
    if (!row || !pendingStatus) return;
    setBusy(true);
    const result = await supabase.from("iptv_users").update({ status: pendingStatus.status }).eq("id", row.id);
    setBusy(false);
    setPendingStatus(null);
    if (result.error) {
      setError(humanError(result.error));
      return;
    }
    setNotice("Estado de la cuenta actualizado.");
    await load();
  }

  async function saveSubscription() {
    if (!selected) return;
    setBusy(true);
    const result = await supabase.from("subscriptions").update({
      plan_id: planId,
      starts_at: starts,
      ends_at: ends,
      max_connections: connections,
    }).eq("id", selected);
    setBusy(false);
    if (result.error) {
      setError(humanError(result.error));
      return;
    }
    setNotice("Suscripción actualizada.");
    await load();
  }

  async function changeSubStatus(status: SubStatus) {
    if (!selected) return;
    setBusy(true);
    const result = await supabase.from("subscriptions").update({ status }).eq("id", selected);
    setBusy(false);
    if (result.error) {
      setError(humanError(result.error));
      return;
    }
    setNotice("Estado de la suscripción actualizado.");
    await load();
  }

  async function renew() {
    if (!row || !planId) return;
    setBusy(true);
    const result = await supabase.rpc("renew_subscription", { p_user_id: row.id, p_plan_id: planId });
    setBusy(false);
    if (result.error) {
      setError(humanError(result.error));
      return;
    }
    setNotice("Suscripción renovada.");
    await load();
  }

  async function downloadPlaylist() {
    if (!row) return;
    setBusy(true);
    try {
      const channels = await fetchChannelsForPlan(row.plan_id);
      if (channels.length === 0) {
        setError("No hay canales para este plan. Importa una lista M3U o asigna grupos.");
        return;
      }
      downloadText(`${row.username}.m3u`, toM3u(channels), "audio/x-mpegurl");
    } catch (downloadError) {
      setError(humanError(downloadError));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (!row) return <section><PageHead title="Cuenta" /><Empty title="Cuenta no encontrada" text="Puede haber sido eliminada o el enlace ya no es válido." /></section>;

  const current = subs.find((sub) => sub.id === selected) ?? null;
  const liveUrl = playlistUrl(row.username, row.line_password);

  return (
    <section>
      <PageHead title={row.client_name} text={`${row.username} · línea IPTV`}>
        <Link className="btn ghost" to="/cuentas">Volver</Link>
      </PageHead>
      {error ? <Banner kind="error">{error}</Banner> : null}
      {notice ? <Banner kind="ok">{notice}</Banner> : null}
      <div className="split">
        <article className="card credentials">
          <div className="card-title">
            <h2>Credenciales</h2>
            <StatusBadge value={row.status} />
          </div>
          <p><span>Usuario</span><strong>{row.username}</strong></p>
          <p><span>Contraseña</span><strong>{row.line_password}</strong></p>
          <p><span>Conexiones</span><strong>{row.max_connections ?? "—"}</strong></p>
          <p><span>Vigencia</span><strong>{formatDate(row.starts_at)} — {formatDate(row.ends_at)}</strong></p>
          <p className="url-line"><span>URL M3U</span><code>{liveUrl}</code></p>
          <div className="actions wrap">
            <button type="button" className="btn small" onClick={() => void copy("usuario", row.username)}>{copied === "usuario" ? "Copiado" : "Copiar usuario"}</button>
            <button type="button" className="btn small" onClick={() => void copy("clave", row.line_password)}>{copied === "clave" ? "Copiado" : "Copiar clave"}</button>
            <button type="button" className="btn small" onClick={() => void copy("url", liveUrl)}>{copied === "url" ? "Copiado" : "Copiar URL"}</button>
            <button type="button" className="btn small" onClick={() => void downloadPlaylist()} disabled={busy}>Descargar M3U</button>
            <button type="button" className="btn small" onClick={() => void resetPassword()} disabled={busy}>Nueva contraseña</button>
          </div>
          <p className="hint">La URL funciona cuando la función playlist está desplegada. La descarga arma el archivo con los canales del plan desde este panel.</p>
          <div className="actions wrap">
            {nextUserStatuses(row.status).map((item) => (
              <button key={item.status} type="button" className="btn small" onClick={() => setPendingStatus(item)}>{item.label}</button>
            ))}
          </div>
        </article>
        <article className="card">
          <h2>Cliente</h2>
          <p>{row.client_phone || "Sin teléfono"}</p>
          <p>{row.client_email || "Sin correo"}</p>
          <p>{row.client_address || "Sin dirección"}</p>
          <Field label="Notas de la cuenta">
            <textarea value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          <button type="button" className="btn" onClick={() => void saveNotes()} disabled={busy}>Guardar notas</button>
        </article>
      </div>
      <article className="card">
        <div className="card-title">
          <h2>Suscripción</h2>
          {current ? <StatusBadge value={current.status} /> : null}
        </div>
        {subs.length === 0 ? <Empty title="Sin suscripción" text="Renueva la cuenta para crear una vigencia nueva." /> : (
          <>
            <div className="sub-list">
              {subs.map((sub) => (
                <button type="button" key={sub.id} className={sub.id === selected ? "on" : ""} onClick={() => choose(sub)}>
                  {formatDate(sub.starts_at)} — {formatDate(sub.ends_at)} · {sub.status}
                </button>
              ))}
            </div>
            <div className="grid-2">
              <Field label="Plan">
                <select value={planId} onChange={(event) => setPlanId(event.target.value)}>
                  {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}{plan.active ? "" : " (inactivo)"}</option>)}
                </select>
              </Field>
              <Field label="Conexiones">
                <input type="number" min={1} value={connections} onChange={(event) => setConnections(Number(event.target.value))} />
              </Field>
              <Field label="Inicio">
                <input type="date" value={starts} onChange={(event) => setStarts(event.target.value)} />
              </Field>
              <Field label="Fin">
                <input type="date" value={ends} onChange={(event) => setEnds(event.target.value)} />
              </Field>
            </div>
            <div className="actions wrap">
              <button type="button" className="btn primary" disabled={busy || current?.status === "cancelada"} onClick={() => void saveSubscription()}>Guardar cambios</button>
              <button type="button" className="btn" disabled={busy} onClick={() => void renew()}>Renovar</button>
              {current ? nextSubStatuses(current.status).map((status) => (
                <button key={status} type="button" className="btn small" disabled={busy} onClick={() => void changeSubStatus(status)}>{status}</button>
              )) : null}
            </div>
          </>
        )}
      </article>
      {pendingStatus ? (
        <Modal title={pendingStatus.label} onClose={() => setPendingStatus(null)}>
          <p>{pendingStatus.warning}</p>
          <div className="actions">
            <button type="button" className="btn ghost" onClick={() => setPendingStatus(null)}>Cancelar</button>
            <button type="button" className="btn primary" disabled={busy} onClick={() => void applyStatus()}>{busy ? "Aplicando…" : "Confirmar"}</button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
