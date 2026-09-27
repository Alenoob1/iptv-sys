import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Banner, Empty, Glyph, Loading, useTitle } from "../components/ui";
import { dueLabel, todayISO } from "../lib/format";
import { humanError } from "../lib/rules";
import { supabase } from "../lib/supabase";
import type { DirectoryRow, UserStatus } from "../types";

function inService(row: DirectoryRow, day: string) {
  return row.status === "activo"
    && row.subscription_status === "activa"
    && !!row.starts_at
    && !!row.ends_at
    && row.starts_at.slice(0, 10) <= day
    && row.ends_at.slice(0, 10) >= day;
}

function dotClass(row: DirectoryRow, day: string) {
  if (inService(row, day)) return "pulse on";
  if (row.status === "suspendido") return "pulse wait";
  return "pulse off";
}

export function ConnectionsPage() {
  useTitle("Conexiones");
  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | "servicio" | UserStatus>("servicio");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);

  async function load(quiet = false) {
    if (!quiet) setLoading(true);
    setError(null);
    const result = await supabase.from("iptv_directory").select("*").order("created_at", { ascending: false }).limit(500);
    if (!quiet) setLoading(false);
    if (result.error) {
      setError(humanError(result.error));
      return;
    }
    setRows((result.data ?? []) as DirectoryRow[]);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(() => { void load(true); }, 20000);
    return () => window.clearInterval(timer);
  }, [auto]);

  const today = todayISO();
  const term = query.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (status === "servicio" && !inService(row, today)) return false;
    if (status && status !== "servicio" && row.status !== status) return false;
    if (!term) return true;
    return row.username.toLowerCase().includes(term) || row.client_name.toLowerCase().includes(term) || (row.plan_name ?? "").toLowerCase().includes(term);
  });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <section>
      <header className="sheet-top">
        <div>
          <h1>Conexiones</h1>
          <p>Líneas vigentes del panel. El punto verde es una cuenta en servicio, no una sesión de red.</p>
        </div>
        <div className="sheet-tools">
          <button className="btn warn icon-only" type="button" title="Actualizar" aria-label="Actualizar" onClick={() => void load()}><Glyph name="refresh" /></button>
          <button className={auto ? "btn auto on" : "btn auto"} type="button" onClick={() => setAuto((value) => !value)}>Auto</button>
        </div>
      </header>
      {error ? <Banner kind="error">{error}</Banner> : null}
      <div className="sheet">
        <form className="sheet-filters" onSubmit={(event) => event.preventDefault()}>
          <input placeholder="Buscar usuario o cliente" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
          <select value={status} aria-label="Estado" onChange={(event) => { setStatus(event.target.value as "" | "servicio" | UserStatus); setPage(0); }}>
            <option value="servicio">En servicio</option>
            <option value="">Todas</option>
            <option value="activo">Activas</option>
            <option value="suspendido">Suspendidas</option>
            <option value="inactivo">Inactivas</option>
          </select>
          <select value={pageSize} aria-label="Mostrar" onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }}>
            <option value={10}>Mostrar 10</option>
            <option value={25}>Mostrar 25</option>
            <option value={50}>Mostrar 50</option>
          </select>
        </form>
        {loading ? <Loading /> : visible.length === 0 ? <Empty title="Sin conexiones" text="No hay líneas en este filtro. Prueba con Todas." /> : (
          <div className="table-wrap">
            <table className="connections">
              <thead>
                <tr>
                  <th>Id</th>
                  <th>Estado</th>
                  <th>Usuario</th>
                  <th>Cliente</th>
                  <th>Plan</th>
                  <th>Servidor</th>
                  <th>Vigencia</th>
                  <th>Conex.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{row.id.slice(0, 8)}</td>
                    <td><span className={dotClass(row, today)} title={inService(row, today) ? "En servicio" : row.status} /></td>
                    <td><strong>{row.username}</strong></td>
                    <td>{row.client_name}</td>
                    <td>{row.plan_name || "—"}</td>
                    <td>Principal</td>
                    <td>{dueLabel(row.ends_at)}</td>
                    <td>{row.max_connections ?? "—"}</td>
                    <td>
                      <Link className="go" to={`/cuentas/${row.id}`} aria-label={`Abrir ${row.username}`}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12M13 6l6 6-6 6" /></svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pager">
          <button type="button" className="btn small" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Anterior</button>
          <span>{safePage + 1} de {pages}</span>
          <button type="button" className="btn small" disabled={safePage + 1 >= pages} onClick={() => setPage(safePage + 1)}>Siguiente</button>
        </div>
      </div>
    </section>
  );
}
