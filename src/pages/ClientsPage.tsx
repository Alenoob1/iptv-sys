import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Banner, Empty, Field, Glyph, Loading, Modal, PageHead } from "../components/ui";
import { humanError } from "../lib/rules";
import { supabase } from "../lib/supabase";
import type { Client } from "../types";

const emptyForm = { name: "", phone: "", email: "", address: "" };

export function ClientsPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  async function load(term = query) {
    setLoading(true);
    setError(null);
    let request = supabase.from("clients").select("*").order("name");
    const clean = term.trim().replace(/[%_,]/g, "");
    if (clean) request = request.or(`name.ilike.%${clean}%,phone.ilike.%${clean}%,email.ilike.%${clean}%`);
    const result = await request;
    setLoading(false);
    if (result.error) {
      setError(humanError(result.error));
      return;
    }
    setRows((result.data ?? []) as Client[]);
  }

  useEffect(() => {
    void load("");
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setCreating(true);
    setEditing(null);
  }

  function openEdit(client: Client) {
    setForm({ name: client.name, phone: client.phone ?? "", email: client.email ?? "", address: client.address ?? "" });
    setEditing(client);
    setCreating(false);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (form.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
      setError("El correo no es válido.");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
    };
    const result = editing
      ? await supabase.from("clients").update(payload).eq("id", editing.id)
      : await supabase.from("clients").insert(payload);
    setBusy(false);
    if (result.error) {
      setError(humanError(result.error));
      return;
    }
    setCreating(false);
    setEditing(null);
    setNotice(editing ? "Cliente actualizado." : "Cliente registrado.");
    await load();
  }

  async function remove(client: Client) {
    if (!window.confirm(`¿Eliminar a ${client.name}? Solo es posible si no tiene cuentas IPTV.`)) return;
    const result = await supabase.from("clients").delete().eq("id", client.id);
    if (result.error) {
      setError(humanError(result.error));
      return;
    }
    setNotice("Cliente eliminado.");
    await load();
  }

  return (
    <section>
      <PageHead title="Clientes" text="Cada cuenta IPTV pertenece a un cliente registrado.">
        <button type="button" className="btn add" onClick={openCreate}><Glyph name="plus" /> Nuevo cliente</button>
      </PageHead>
      {error ? <Banner kind="error">{error}</Banner> : null}
      {notice ? <Banner kind="ok">{notice}</Banner> : null}
      <form className="toolbar" onSubmit={(event) => { event.preventDefault(); void load(); }}>
        <input placeholder="Buscar por nombre, teléfono o correo" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button className="btn search" type="submit"><Glyph name="search" /> Buscar</button>
      </form>
      {loading ? <Loading /> : rows.length === 0 ? <Empty title="Sin clientes" text="Registra el titular antes de generar su cuenta IPTV, o créalo al generar la cuenta." /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>Dirección</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((client) => (
                <tr key={client.id}>
                  <td>{client.name}</td>
                  <td>{client.phone || "—"}</td>
                  <td>{client.email || "—"}</td>
                  <td>{client.address || "—"}</td>
                  <td>
                    <div className="icon-actions">
                      <button type="button" title="Editar" aria-label={`Editar ${client.name}`} onClick={() => openEdit(client)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 20h4l10-10-4-4L4 16z" /><path d="m12 6 4 4" /></svg>
                      </button>
                      {profile?.role === "administrador" ? (
                        <button type="button" className="danger" title="Eliminar" aria-label={`Eliminar ${client.name}`} onClick={() => void remove(client)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" /></svg>
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(creating || editing) ? (
        <Modal title={editing ? "Editar cliente" : "Nuevo cliente"} onClose={() => { setCreating(false); setEditing(null); }}>
          <form className="stack" onSubmit={(event) => void onSubmit(event)}>
            <Field label="Nombre"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
            <Field label="Teléfono"><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
            <Field label="Correo"><input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
            <Field label="Dirección"><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field>
            <div className="actions">
              <button type="button" className="btn ghost" onClick={() => { setCreating(false); setEditing(null); }}>Cancelar</button>
              <button className="btn primary" type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
