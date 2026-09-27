import { useEffect, useState } from "react";
import { Banner, Empty, Loading, PageHead } from "../components/ui";
import { formatDateTime } from "../lib/format";
import { auditSummary, entityLabel, humanError } from "../lib/rules";
import { supabase } from "../lib/supabase";
import type { AuditRow } from "../types";

export function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [entity, setEntity] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(nextEntity = entity) {
    setLoading(true);
    setError(null);
    let request = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(150);
    if (nextEntity) request = request.eq("entity", nextEntity);
    const result = await request;
    if (result.error) {
      setLoading(false);
      setError(humanError(result.error));
      return;
    }
    const events = (result.data ?? []) as AuditRow[];
    const ids = [...new Set(events.map((event) => event.actor_id).filter((value): value is string => Boolean(value)))];
    let people: Record<string, string> = {};
    if (ids.length > 0) {
      const profiles = await supabase.from("profiles").select("id, full_name").in("id", ids);
      if (profiles.error) {
        setLoading(false);
        setError(humanError(profiles.error));
        return;
      }
      people = Object.fromEntries(((profiles.data ?? []) as { id: string; full_name: string }[]).map((person) => [person.id, person.full_name]));
    }
    setNames(people);
    setRows(events);
    setLoading(false);
  }

  useEffect(() => {
    void load("");
  }, []);

  return (
    <section>
      <PageHead title="Historial" text="Cada alta, cambio de estado y edición relevante queda con fecha y responsable." />
      {error ? <Banner kind="error">{error}</Banner> : null}
      <form className="toolbar" onSubmit={(event) => { event.preventDefault(); void load(); }}>
        <select value={entity} onChange={(event) => setEntity(event.target.value)}>
          <option value="">Todas las entidades</option>
          {Object.entries(entityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button className="btn" type="submit">Filtrar</button>
      </form>
      {loading ? <Loading /> : rows.length === 0 ? <Empty title="Sin eventos" text="Cuando el personal registre o modifique datos, el historial se irá llenando." /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Responsable</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td>{row.actor_id ? names[row.actor_id] ?? "Personal" : "Sistema"}</td>
                  <td>{row.action}</td>
                  <td>{entityLabel[row.entity] ?? row.entity}</td>
                  <td>{auditSummary(row.detail ?? {})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
