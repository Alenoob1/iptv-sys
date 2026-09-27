import { useEffect, useState } from "react";
import { Banner, Empty, Glyph, Loading, PageHead, StatusBadge } from "../components/ui";
import { downloadText } from "../lib/playlists";
import { formatDate } from "../lib/format";
import { humanError } from "../lib/rules";
import { supabase } from "../lib/supabase";
import type { DirectoryRow, Plan, SubStatus, UserStatus } from "../types";

function csvCell(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

export function ReportsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [userStatus, setUserStatus] = useState<"" | UserStatus>("");
  const [subStatus, setSubStatus] = useState<"" | SubStatus>("");
  const [planId, setPlanId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [withSecrets, setWithSecrets] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);

  useEffect(() => {
    void supabase.from("plans").select("*").order("name").then((result) => {
      if (!result.error) setPlans((result.data ?? []) as Plan[]);
    });
  }, []);

  async function run() {
    setLoading(true);
    setError(null);
    const collected: DirectoryRow[] = [];
    for (let page = 0; page < 5; page += 1) {
      let request = supabase.from("iptv_directory").select("*").order("client_name");
      if (userStatus) request = request.eq("status", userStatus);
      if (subStatus) request = request.eq("subscription_status", subStatus);
      if (planId) request = request.eq("plan_id", planId);
      if (from) request = request.gte("ends_at", from);
      if (to) request = request.lte("ends_at", to);
      const start = page * 1000;
      const result = await request.range(start, start + 999);
      if (result.error) {
        setLoading(false);
        setError(humanError(result.error));
        return;
      }
      const chunk = (result.data ?? []) as DirectoryRow[];
      collected.push(...chunk);
      if (chunk.length < 1000) break;
    }
    setRows(collected);
    setRan(true);
    setLoading(false);
  }

  function exportCsv() {
    const header = ["cliente", "telefono", "usuario", "estado_cuenta", "plan", "estado_suscripcion", "inicio", "fin", "conexiones"];
    if (withSecrets) header.push("contrasena_linea");
    const lines = [header.join(",")];
    for (const row of rows) {
      const cells = [
        row.client_name,
        row.client_phone ?? "",
        row.username,
        row.status,
        row.plan_name ?? "",
        row.subscription_status ?? "",
        row.starts_at ?? "",
        row.ends_at ?? "",
        String(row.max_connections ?? ""),
      ];
      if (withSecrets) cells.push(row.line_password);
      lines.push(cells.map(csvCell).join(","));
    }
    downloadText(`reporte-iptv-${new Date().toISOString().slice(0, 10)}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
  }

  return (
    <section>
      <PageHead title="Reportes" text="Filtra cuentas y suscripciones. El archivo CSV sale con el resultado que estás viendo." />
      {error ? <Banner kind="error">{error}</Banner> : null}
      <form className="toolbar" onSubmit={(event) => { event.preventDefault(); void run(); }}>
        <select value={userStatus} onChange={(event) => setUserStatus(event.target.value as "" | UserStatus)}>
          <option value="">Estado de cuenta</option>
          <option value="activo">Activo</option>
          <option value="suspendido">Suspendido</option>
          <option value="inactivo">Inactivo</option>
        </select>
        <select value={subStatus} onChange={(event) => setSubStatus(event.target.value as "" | SubStatus)}>
          <option value="">Estado de suscripción</option>
          <option value="pendiente">Pendiente</option>
          <option value="activa">Activa</option>
          <option value="suspendida">Suspendida</option>
          <option value="vencida">Vencida</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <select value={planId} onChange={(event) => setPlanId(event.target.value)}>
          <option value="">Todos los planes</option>
          {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
        </select>
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Vence desde" />
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Vence hasta" />
        <button className="btn search" type="submit"><Glyph name="search" /> Generar</button>
      </form>
      {loading ? <Loading /> : null}
      {ran && !loading && rows.length === 0 ? <Empty title="Sin resultados" text="No hay cuentas para esos filtros." /> : null}
      {rows.length > 0 ? (
        <>
          <div className="toolbar">
            <strong>{rows.length} registro{rows.length === 1 ? "" : "s"}</strong>
            <label className="check"><input type="checkbox" checked={withSecrets} onChange={(event) => setWithSecrets(event.target.checked)} /> Incluir contraseñas de línea</label>
            <button type="button" className="btn" onClick={exportCsv}>Exportar CSV</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Cliente</th><th>Usuario</th><th>Plan</th><th>Cuenta</th><th>Suscripción</th><th>Fin</th></tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((row) => (
                  <tr key={row.id}>
                    <td>{row.client_name}</td>
                    <td>{row.username}</td>
                    <td>{row.plan_name || "—"}</td>
                    <td><StatusBadge value={row.status} /></td>
                    <td><StatusBadge value={row.subscription_status} /></td>
                    <td>{formatDate(row.ends_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 200 ? <p className="hint">La tabla muestra 200 filas. El CSV incluye las {rows.length}.</p> : null}
        </>
      ) : null}
    </section>
  );
}
