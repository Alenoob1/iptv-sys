import { useEffect, useState } from "react";
import { Banner, Empty, Loading, PageHead } from "../components/ui";
import { formatDate } from "../lib/format";
import { humanError } from "../lib/rules";
import { supabase } from "../lib/supabase";
import type { RoleRow, StaffRow } from "../types";

type Draft = { full_name: string; role_id: string; active: boolean };

export function StaffPage() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [people, roleRows] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("roles").select("*").order("name"),
    ]);
    setLoading(false);
    if (people.error || roleRows.error) {
      setError(humanError(people.error ?? roleRows.error));
      return;
    }
    const staff = (people.data ?? []) as StaffRow[];
    setRows(staff);
    setRoles((roleRows.data ?? []) as RoleRow[]);
    setDrafts(Object.fromEntries(staff.map((person) => [person.id, { full_name: person.full_name, role_id: person.role_id, active: person.active }])));
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(id: string) {
    const draft = drafts[id];
    if (!draft) return;
    setBusyId(id);
    setError(null);
    const result = await supabase.from("profiles").update({
      full_name: draft.full_name.trim(),
      role_id: draft.role_id,
      active: draft.active,
    }).eq("id", id);
    setBusyId(null);
    if (result.error) {
      setError(humanError(result.error));
      return;
    }
    setNotice("Permisos actualizados.");
    await load();
  }

  return (
    <section>
      <PageHead title="Personal" text="Los ingresos del panel se crean en Authentication de Supabase. Aquí se asigna el rol. La primera cuenta es administrador; las siguientes entran como operador." />
      {error ? <Banner kind="error">{error}</Banner> : null}
      {notice ? <Banner kind="ok">{notice}</Banner> : null}
      {loading ? <Loading /> : rows.length === 0 ? <Empty title="Sin personal" text="Crea un usuario en Supabase Authentication y vuelve a abrir esta pantalla." /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Activo</th><th>Desde</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((person) => {
                const draft = drafts[person.id];
                if (!draft) return null;
                return (
                  <tr key={person.id}>
                    <td><input value={draft.full_name} onChange={(event) => setDrafts({ ...drafts, [person.id]: { ...draft, full_name: event.target.value } })} /></td>
                    <td>{person.email || "—"}</td>
                    <td>
                      <select value={draft.role_id} onChange={(event) => setDrafts({ ...drafts, [person.id]: { ...draft, role_id: event.target.value } })}>
                        {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                      </select>
                    </td>
                    <td><input type="checkbox" checked={draft.active} onChange={(event) => setDrafts({ ...drafts, [person.id]: { ...draft, active: event.target.checked } })} aria-label="Cuenta activa" /></td>
                    <td>{formatDate(person.created_at)}</td>
                    <td><button type="button" className="btn small" disabled={busyId === person.id} onClick={() => void save(person.id)}>{busyId === person.id ? "…" : "Guardar"}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
