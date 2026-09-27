import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Banner, Empty, Field, Glyph, Loading, Modal, PageHead } from "../components/ui";
import { money } from "../lib/format";
import { humanError } from "../lib/rules";
import { supabase } from "../lib/supabase";
import type { Plan } from "../types";

const emptyPlan = { name: "", description: "", price: "150", duration_days: "30", max_connections: "1", active: true };

export function PlansPage() {
  const { profile } = useAuth();
  const admin = profile?.role === "administrador";
  const [plans, setPlans] = useState<Plan[]>([]);
  const [groups, setGroups] = useState<{ group_title: string; channel_count: number }[]>([]);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState(emptyPlan);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const [planResult, groupResult] = await Promise.all([
      supabase.from("plans").select("*").order("name"),
      supabase.rpc("channel_groups"),
    ]);
    setLoading(false);
    if (planResult.error) {
      setError(humanError(planResult.error));
      return;
    }
    setPlans((planResult.data ?? []) as Plan[]);
    if (!groupResult.error) setGroups((groupResult.data ?? []) as { group_title: string; channel_count: number }[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function openGroups(plan: Plan) {
    setSelected(plan);
    const result = await supabase.from("plan_groups").select("group_title").eq("plan_id", plan.id);
    if (result.error) {
      setError(humanError(result.error));
      return;
    }
    setAssigned(((result.data ?? []) as { group_title: string }[]).map((row) => row.group_title));
  }

  async function saveGroups() {
    if (!selected) return;
    setBusy(true);
    const removed = await supabase.from("plan_groups").delete().eq("plan_id", selected.id);
    if (removed.error) {
      setBusy(false);
      setError(humanError(removed.error));
      return;
    }
    if (assigned.length > 0) {
      const inserted = await supabase.from("plan_groups").insert(assigned.map((group) => ({ plan_id: selected.id, group_title: group })));
      if (inserted.error) {
        setBusy(false);
        setError(humanError(inserted.error));
        return;
      }
    }
    setBusy(false);
    setNotice(assigned.length === 0 ? "El plan entrega todos los canales importados." : "Grupos del plan actualizados.");
    setSelected(null);
  }

  function startEdit(plan?: Plan) {
    setEditing(plan ?? null);
    setForm(plan ? {
      name: plan.name,
      description: plan.description ?? "",
      price: String(plan.price),
      duration_days: String(plan.duration_days),
      max_connections: String(plan.max_connections),
      active: plan.active,
    } : emptyPlan);
    setOpen(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      duration_days: Number(form.duration_days),
      max_connections: Number(form.max_connections),
      active: form.active,
    };
    const result = editing
      ? await supabase.from("plans").update(payload).eq("id", editing.id)
      : await supabase.from("plans").insert(payload);
    setBusy(false);
    if (result.error) {
      setError(humanError(result.error));
      return;
    }
    setOpen(false);
    setNotice(editing ? "Plan actualizado." : "Plan creado.");
    await load();
  }

  const visibleGroups = useMemo(() => {
    const term = filter.trim().toLocaleLowerCase("es");
    return groups.filter((group) => group.group_title.toLocaleLowerCase("es").includes(term));
  }, [filter, groups]);

  return (
    <section>
      <PageHead title="Planes" text="La vigencia y las conexiones salen del plan. Los grupos deciden qué canales entran en la lista del cliente.">
        {admin ? <button type="button" className="btn add" onClick={() => startEdit()}><Glyph name="plus" /> Nuevo plan</button> : null}
      </PageHead>
      {error ? <Banner kind="error">{error}</Banner> : null}
      {notice ? <Banner kind="ok">{notice}</Banner> : null}
      {loading ? <Loading /> : plans.length === 0 ? <Empty title="Sin planes" text="Crea un plan antes de generar cuentas." /> : (
        <div className="plan-grid">
          {plans.map((plan) => (
            <article key={plan.id} className="card">
              <div className="card-title">
                <h2>{plan.name}</h2>
                <span className={`badge ${plan.active ? "activa" : "inactivo"}`}>{plan.active ? "activo" : "inactivo"}</span>
              </div>
              <p>{plan.description || "Sin descripción"}</p>
              <strong>{money(plan.price)}</strong>
              <p className="hint">{plan.duration_days} días · {plan.max_connections} conexión{plan.max_connections === 1 ? "" : "es"}</p>
              {admin ? (
                <div className="actions">
                  <button type="button" className="btn small" onClick={() => startEdit(plan)}>Editar</button>
                  <button type="button" className="btn small" onClick={() => void openGroups(plan)}>Grupos</button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
      {open ? (
        <Modal title={editing ? "Editar plan" : "Nuevo plan"} onClose={() => setOpen(false)}>
          <form className="stack" onSubmit={(event) => void onSubmit(event)}>
            <Field label="Nombre"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
            <Field label="Descripción"><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
            <div className="grid-2">
              <Field label="Precio (GTQ)"><input type="number" min={0} step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></Field>
              <Field label="Días"><input type="number" min={1} value={form.duration_days} onChange={(event) => setForm({ ...form, duration_days: event.target.value })} /></Field>
              <Field label="Conexiones"><input type="number" min={1} value={form.max_connections} onChange={(event) => setForm({ ...form, max_connections: event.target.value })} /></Field>
              <label className="check"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Plan activo</label>
            </div>
            <div className="actions">
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="btn primary" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        </Modal>
      ) : null}
      {selected ? (
        <Modal title={`Grupos de ${selected.name}`} onClose={() => setSelected(null)}>
          <p className="hint">Si no marcas ninguno, la cuenta recibe todos los canales importados.</p>
          <input placeholder="Filtrar grupos" value={filter} onChange={(event) => setFilter(event.target.value)} />
          {groups.length === 0 ? <Empty title="Sin grupos" text="Importa una lista M3U para poder asignar grupos a este plan." /> : (
            <div className="check-grid">
              {visibleGroups.map((group) => (
                <label key={group.group_title}>
                  <input
                    type="checkbox"
                    checked={assigned.includes(group.group_title)}
                    onChange={(event) => setAssigned((current) => event.target.checked ? [...current, group.group_title] : current.filter((item) => item !== group.group_title))}
                  />
                  <span>{group.group_title}</span>
                  <small>{group.channel_count}</small>
                </label>
              ))}
            </div>
          )}
          <div className="actions">
            <button type="button" className="btn ghost" onClick={() => setSelected(null)}>Cerrar</button>
            <button type="button" className="btn primary" disabled={busy} onClick={() => void saveGroups()}>{busy ? "Guardando…" : "Guardar grupos"}</button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
