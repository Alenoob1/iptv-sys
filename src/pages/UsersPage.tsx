import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CreateAccountModal } from "../components/CreateAccountModal";
import { Banner, Empty, Glyph, Loading, Modal, useTitle } from "../components/ui";
import { daysUntil, formatDate } from "../lib/format";
import { humanError } from "../lib/rules";
import { supabase } from "../lib/supabase";
import type { DirectoryRow, UserStatus } from "../types";

function Mark({ ok }: { ok: boolean }) {
  return <span className={ok ? "mark-yes" : "mark-no"} aria-label={ok ? "Sí" : "No"}>{ok ? "✓" : "✕"}</span>;
}

export function UsersPage() {
  useTitle("Usuarios");
  const navigate = useNavigate();
  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | UserStatus>("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [auto, setAuto] = useState(false);

  async function load(nextPage = page, term = query, nextStatus = status, size = pageSize, quiet = false) {
    if (!quiet) setLoading(true);
    setError(null);
    const clean = term.trim().replace(/[%_,]/g, "");
    let request = supabase.from("iptv_directory").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (clean) request = request.or(`username.ilike.%${clean}%,client_name.ilike.%${clean}%,client_phone.ilike.%${clean}%`);
    if (nextStatus) request = request.eq("status", nextStatus);
    const from = nextPage * size;
    const result = await request.range(from, from + size - 1);
    if (!quiet) setLoading(false);
    if (result.error) {
      setError(humanError(result.error));
      return;
    }
    setRows((result.data ?? []) as DirectoryRow[]);
    setTotal(result.count ?? 0);
  }

  useEffect(() => {
    void load(0, "", "", 10);
  }, []);

  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(() => { void load(page, query, status, pageSize, true); }, 20000);
    return () => window.clearInterval(timer);
  }, [auto, page, query, status, pageSize]);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copiado.`);
    } catch {
      setNotice(`${label}: ${value}`);
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section>
      <header className="sheet-top">
        <div>
          <h1>Usuarios</h1>
          <p>Usuario, clave de línea y vigencia. La clave se entrega al cliente.</p>
        </div>
        <div className="sheet-tools">
          <button className="btn warn icon-only" type="button" title="Actualizar" aria-label="Actualizar" onClick={() => void load()}><Glyph name="refresh" /></button>
          <button className="btn search icon-only" type="submit" form="user-filters" title="Buscar" aria-label="Buscar"><Glyph name="search" /></button>
          <button className={auto ? "btn auto on" : "btn auto"} type="button" onClick={() => setAuto((value) => !value)}>Auto</button>
          <button className="btn add" type="button" onClick={() => setCreating(true)}><Glyph name="plus" /> Cuenta</button>
        </div>
      </header>
      {error ? <Banner kind="error">{error}</Banner> : null}
      {notice ? <Banner kind="ok">{notice}</Banner> : null}
      <div className="sheet">
        <form id="user-filters" className="sheet-filters" onSubmit={(event) => { event.preventDefault(); setPage(0); void load(0); }}>
          <input placeholder="Buscar usuario" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select value={status} aria-label="Estado" onChange={(event) => { const value = event.target.value as "" | UserStatus; setStatus(value); setPage(0); void load(0, query, value); }}>
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="suspendido">Suspendido</option>
            <option value="inactivo">Inactivo</option>
          </select>
          <select value={pageSize} aria-label="Mostrar" onChange={(event) => { const size = Number(event.target.value); setPageSize(size); setPage(0); void load(0, query, status, size); }}>
            <option value={10}>Mostrar 10</option>
            <option value={25}>Mostrar 25</option>
            <option value={50}>Mostrar 50</option>
          </select>
        </form>
        {loading ? <Loading /> : rows.length === 0 ? <Empty title="Sin usuarios" text="Genera una cuenta para verla en esta tabla." /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Id</th>
                  <th>Usuario</th>
                  <th>Contraseña</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Vencimiento</th>
                  <th>Días</th>
                  <th>Conex.</th>
                  <th>Info</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const days = daysUntil(row.ends_at);
                  return (
                    <tr key={row.id}>
                      <td>{row.id.slice(0, 8)}</td>
                      <td><strong>{row.username}</strong><small>{row.client_name}</small></td>
                      <td className="mono">{row.line_password}</td>
                      <td>{row.plan_name || "—"}</td>
                      <td><Mark ok={row.status === "activo"} /></td>
                      <td>{formatDate(row.ends_at)}</td>
                      <td>{days === null ? "—" : days}</td>
                      <td>{row.max_connections ?? "—"}</td>
                      <td>{row.notes || "—"}</td>
                      <td>
                        <div className="icon-actions">
                          <Link to={`/cuentas/${row.id}`} title="Ver" aria-label={`Ver ${row.username}`}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
                          </Link>
                          <button type="button" title="Copiar usuario" aria-label={`Copiar usuario ${row.username}`} onClick={() => void copy("Usuario", row.username)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 10V7a2 2 0 0 1 2-2h8v8a2 2 0 0 1-2 2h-3" /><rect x="4" y="10" width="10" height="10" rx="2" /></svg>
                          </button>
                          <button type="button" title="Copiar clave" aria-label={`Copiar clave de ${row.username}`} onClick={() => void copy("Clave", row.line_password)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="15" r="3" /><path d="M11 15h9l-2 2M17 15l2-2" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="pager">
          <button type="button" className="btn small" disabled={page === 0} onClick={() => { const next = page - 1; setPage(next); void load(next); }}>Anterior</button>
          <span>{page + 1} de {pages}</span>
          <button type="button" className="btn small" disabled={page + 1 >= pages} onClick={() => { const next = page + 1; setPage(next); void load(next); }}>Siguiente</button>
        </div>
      </div>
      {creating ? (
        <Modal title="Generar cuenta IPTV" onClose={() => setCreating(false)}>
          <CreateAccountModal onClose={() => setCreating(false)} onCreated={(id) => navigate(`/cuentas/${id}`, { state: { created: true } })} />
        </Modal>
      ) : null}
    </section>
  );
}
