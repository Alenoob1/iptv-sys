import type { Session } from "@supabase/supabase-js";
import { addDays, todayISO } from "./format";

export const DEMO_EMAIL = "admin@fibcom.local";
export const DEMO_PASSWORD = "admin123";

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const ROLE_ADMIN = "00000000-0000-4000-8000-000000000010";
const ROLE_OPERATOR = "00000000-0000-4000-8000-000000000011";
const PLAN_BASIC = "00000000-0000-4000-8000-000000000101";
const PLAN_FAMILY = "00000000-0000-4000-8000-000000000102";
const PLAN_PREMIUM = "00000000-0000-4000-8000-000000000103";

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { message: string; code?: string } | null; count?: number | null };

const today = todayISO();

function stamp(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

const db: Record<string, Row[]> = {
  roles: [
    { id: ROLE_ADMIN, name: "administrador", description: "Control total del panel" },
    { id: ROLE_OPERATOR, name: "operador", description: "Gestión de clientes y cuentas" },
  ],
  profiles: [
    {
      id: ADMIN_ID,
      full_name: "Melany Locón",
      email: DEMO_EMAIL,
      role_id: ROLE_ADMIN,
      active: true,
      created_at: stamp(12),
    },
  ],
  permissions: [],
  role_permissions: [],
  clients: [
    { id: "c1", name: "María López", phone: "7845-2210", email: "maria.lopez@correo.com", address: "Zona 1, Chimaltenango", created_at: stamp(20), updated_at: stamp(20) },
    { id: "c2", name: "Carlos Méndez", phone: "5512-9088", email: "carlos.mendez@correo.com", address: "Tecpán", created_at: stamp(14), updated_at: stamp(14) },
    { id: "c3", name: "Ana Ruiz", phone: "4110-3321", email: null, address: "El Tejar", created_at: stamp(8), updated_at: stamp(8) },
    { id: "c4", name: "José García", phone: "3012-7744", email: "jose.garcia@correo.com", address: "San Martín Jilotepeque", created_at: stamp(3), updated_at: stamp(3) },
  ],
  plans: [
    { id: PLAN_BASIC, name: "Básico", description: "Un dispositivo, vigencia de 30 días", price: 150, duration_days: 30, max_connections: 1, active: true, created_at: stamp(30) },
    { id: PLAN_FAMILY, name: "Familiar", description: "Hasta tres dispositivos", price: 220, duration_days: 30, max_connections: 3, active: true, created_at: stamp(30) },
    { id: PLAN_PREMIUM, name: "Premium", description: "Dos dispositivos y todos los grupos", price: 190, duration_days: 30, max_connections: 2, active: true, created_at: stamp(30) },
  ],
  iptv_users: [
    { id: "u1", client_id: "c1", username: "fibmaria", line_password: "linea4812", status: "activo", notes: "Decodificador de sala", created_at: stamp(18), updated_at: stamp(2) },
    { id: "u2", client_id: "c2", username: "fibcarlos", line_password: "linea9021", status: "activo", notes: null, created_at: stamp(10), updated_at: stamp(10) },
    { id: "u3", client_id: "c3", username: "fibana", line_password: "linea7730", status: "suspendido", notes: "Pago pendiente", created_at: stamp(7), updated_at: stamp(1) },
    { id: "u4", client_id: "c4", username: "fibjose", line_password: "linea1104", status: "inactivo", notes: null, created_at: stamp(2), updated_at: stamp(1) },
  ],
  subscriptions: [
    { id: "s1", iptv_user_id: "u1", plan_id: PLAN_FAMILY, status: "activa", starts_at: addDays(today, -25), ends_at: addDays(today, 4), max_connections: 3, created_at: stamp(25), updated_at: stamp(25) },
    { id: "s2", iptv_user_id: "u2", plan_id: PLAN_BASIC, status: "activa", starts_at: addDays(today, -10), ends_at: addDays(today, 20), max_connections: 1, created_at: stamp(10), updated_at: stamp(10) },
    { id: "s3", iptv_user_id: "u3", plan_id: PLAN_PREMIUM, status: "suspendida", starts_at: addDays(today, -12), ends_at: addDays(today, 18), max_connections: 2, created_at: stamp(12), updated_at: stamp(1) },
    { id: "s4", iptv_user_id: "u4", plan_id: PLAN_BASIC, status: "cancelada", starts_at: addDays(today, -40), ends_at: addDays(today, -10), max_connections: 1, created_at: stamp(40), updated_at: stamp(1) },
  ],
  playlists: [
    { id: "p1", name: "Lista principal", source_label: "lista-ejemplo.m3u", channel_count: 4, imported_at: stamp(6) },
  ],
  channels: [
    { id: "ch1", playlist_id: "p1", name: "Noticias demo", group_title: "Noticias", logo_url: null, stream_url: "http://ejemplo.local/live/noticias.m3u8", tvg_id: "demo.noticias" },
    { id: "ch2", playlist_id: "p1", name: "Noticias regional demo", group_title: "Noticias", logo_url: null, stream_url: "http://ejemplo.local/live/noticias-2.m3u8", tvg_id: "demo.noticias2" },
    { id: "ch3", playlist_id: "p1", name: "Deportes demo", group_title: "Deportes", logo_url: null, stream_url: "http://ejemplo.local/live/deportes.m3u8", tvg_id: "demo.deportes" },
    { id: "ch4", playlist_id: "p1", name: "Infantil demo", group_title: "Infantil", logo_url: null, stream_url: "http://ejemplo.local/live/infantil.m3u8", tvg_id: "demo.infantil" },
  ],
  plan_groups: [
    { plan_id: PLAN_BASIC, group_title: "Noticias" },
    { plan_id: PLAN_FAMILY, group_title: "Noticias" },
    { plan_id: PLAN_FAMILY, group_title: "Infantil" },
    { plan_id: PLAN_PREMIUM, group_title: "Noticias" },
    { plan_id: PLAN_PREMIUM, group_title: "Deportes" },
    { plan_id: PLAN_PREMIUM, group_title: "Infantil" },
  ],
  audit_log: [
    { id: "a1", created_at: stamp(2), actor_id: ADMIN_ID, action: "actualizar", entity: "iptv_users", record_id: "u1", detail: { antes: { status: "activo" }, despues: { status: "activo", notes: "Decodificador de sala" } } },
    { id: "a2", created_at: stamp(1), actor_id: ADMIN_ID, action: "actualizar", entity: "subscriptions", record_id: "s3", detail: { antes: { status: "activa" }, despues: { status: "suspendida" } } },
  ],
};

let currentUserId: string | null = sessionStorage.getItem("fibcom-demo-auth") === "1" ? ADMIN_ID : null;
let session: Session | null = currentUserId ? ({ user: { id: ADMIN_ID } } as Session) : null;
const listeners = new Set<(event: string, next: Session | null) => void>();

function emit(event: string) {
  for (const listener of listeners) listener(event, session);
}

function rowsOf(table: string): Row[] {
  if (table === "iptv_directory") return directoryRows();
  return db[table] ?? [];
}

function directoryRows(): Row[] {
  return db.iptv_users.map((user) => {
    const client = db.clients.find((item) => item.id === user.client_id);
    const sub = db.subscriptions
      .filter((item) => item.iptv_user_id === user.id)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    const plan = sub ? db.plans.find((item) => item.id === sub.plan_id) : undefined;
    return {
      id: user.id,
      username: user.username,
      line_password: user.line_password,
      status: user.status,
      notes: user.notes,
      created_at: user.created_at,
      client_id: user.client_id,
      client_name: client?.name ?? "",
      client_phone: client?.phone ?? null,
      client_email: client?.email ?? null,
      client_address: client?.address ?? null,
      subscription_id: sub?.id ?? null,
      subscription_status: sub?.status ?? null,
      starts_at: sub?.starts_at ?? null,
      ends_at: sub?.ends_at ?? null,
      max_connections: sub?.max_connections ?? null,
      plan_id: sub?.plan_id ?? null,
      plan_name: plan?.name ?? null,
      duration_days: plan?.duration_days ?? null,
    };
  });
}

function audit(action: string, entity: string, recordId: unknown, detail: Row) {
  db.audit_log.unshift({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    actor_id: currentUserId,
    action,
    entity,
    record_id: recordId,
    detail,
  });
}

function syncUserStatus(userId: unknown, previous: unknown, next: unknown) {
  if (previous === next) return;
  for (const sub of db.subscriptions) {
    if (sub.iptv_user_id !== userId) continue;
    if (next === "suspendido" && sub.status === "activa") sub.status = "suspendida";
    if (next === "inactivo" && ["pendiente", "activa", "suspendida", "vencida"].includes(String(sub.status))) sub.status = "cancelada";
    if (next === "activo" && previous === "suspendido" && sub.status === "suspendida") {
      sub.status = String(sub.ends_at) < todayISO() ? "vencida" : "activa";
    }
  }
}

type Filter =
  | { kind: "eq"; column: string; value: unknown }
  | { kind: "gte"; column: string; value: unknown }
  | { kind: "lte"; column: string; value: unknown }
  | { kind: "in"; column: string; value: unknown[] }
  | { kind: "or"; raw: string };

function matches(row: Row, filters: Filter[]) {
  return filters.every((filter) => {
    if (filter.kind === "eq") return row[filter.column] === filter.value;
    if (filter.kind === "gte") return String(row[filter.column] ?? "") >= String(filter.value ?? "");
    if (filter.kind === "lte") return String(row[filter.column] ?? "") <= String(filter.value ?? "");
    if (filter.kind === "in") return filter.value.includes(row[filter.column]);
    return filter.raw.split(",").some((part) => {
      const found = /^(\w+)\.ilike\.%(.*)%$/.exec(part.trim());
      if (!found) return false;
      return String(row[found[1]] ?? "").toLowerCase().includes(found[2].toLowerCase());
    });
  });
}

function project(row: Row, columns: string) {
  if (columns.trim() === "*") return { ...row };
  const copy: Row = {};
  for (const key of columns.split(",").map((item) => item.trim())) copy[key] = row[key];
  return copy;
}

class Query {
  private action: "select" | "insert" | "update" | "delete" = "select";
  private filters: Filter[] = [];
  private columns = "*";
  private countMode = false;
  private head = false;
  private singleMode: "one" | "maybe" | null = null;
  private sortKey: string | null = null;
  private ascending = true;
  private max: number | null = null;
  private fromIndex: number | null = null;
  private toIndex: number | null = null;
  private payload: Row | Row[] | null = null;
  private returning = false;
  private pending: Promise<Result> | null = null;

  private table: string;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = "*", options?: { count?: "exact"; head?: boolean }) {
    if (this.action === "insert") this.returning = true;
    else this.action = "select";
    this.columns = columns;
    this.countMode = options?.count === "exact";
    this.head = Boolean(options?.head);
    return this;
  }

  insert(payload: Row | Row[]) {
    this.action = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Row) {
    this.action = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ kind: "eq", column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ kind: "gte", column, value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ kind: "lte", column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ kind: "in", column, value });
    return this;
  }

  or(raw: string) {
    this.filters.push({ kind: "or", raw });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.sortKey = column;
    this.ascending = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.max = count;
    return this;
  }

  range(from: number, to: number) {
    this.fromIndex = from;
    this.toIndex = to;
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  single() {
    this.singleMode = "one";
    return this;
  }

  then<TResult1 = Result, TResult2 = never>(
    onFulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.run().then(onFulfilled, onRejected);
  }

  private run() {
    this.pending ??= Promise.resolve().then(() => this.execute());
    return this.pending;
  }

  private execute(): Result {
    if (this.action === "select") return this.selectRows();
    if (this.action === "insert") return this.insertRows();
    if (this.action === "update") return this.updateRows();
    return this.deleteRows();
  }

  private source() {
    return rowsOf(this.table).filter((row) => matches(row, this.filters));
  }

  private selectRows(): Result {
    let rows = this.source();
    if (this.sortKey) {
      const key = this.sortKey;
      const direction = this.ascending ? 1 : -1;
      rows = [...rows].sort((a, b) => String(a[key] ?? "").localeCompare(String(b[key] ?? "")) * direction);
    }
    const count = rows.length;
    if (this.fromIndex !== null && this.toIndex !== null) rows = rows.slice(this.fromIndex, this.toIndex + 1);
    else if (this.max !== null) rows = rows.slice(0, this.max);
    if (this.head) return { data: null, error: null, count };
    const data = rows.map((row) => project(row, this.columns));
    if (this.singleMode === "maybe") return { data: data[0] ?? null, error: null, count };
    if (this.singleMode === "one") {
      if (!data[0]) return { data: null, error: { message: "No se encontró el registro", code: "PGRST116" }, count };
      return { data: data[0], error: null, count };
    }
    return { data, error: null, count: this.countMode ? count : null };
  }

  private insertRows(): Result {
    const table = db[this.table];
    if (!table) return { data: null, error: { message: "Tabla no disponible" } };
    const incoming = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
    const created: Row[] = [];
    for (const item of incoming) {
      if (this.table === "iptv_users" && table.some((row) => row.username === item.username)) {
        return { data: null, error: { message: "Ese usuario ya existe", code: "23505" } };
      }
      const row: Row = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...item,
      };
      table.push(row);
      created.push(row);
      if (["clients", "iptv_users", "subscriptions", "plans", "playlists", "profiles"].includes(this.table)) {
        audit("crear", this.table, row.id, { ...row });
      }
    }
    if (this.returning || this.singleMode) {
      const data = this.singleMode ? project(created[0] ?? {}, this.columns) : created.map((row) => project(row, this.columns));
      return { data, error: null };
    }
    return { data: null, error: null };
  }

  private updateRows(): Result {
    const table = db[this.table];
    if (!table) return { data: null, error: { message: "Tabla no disponible" } };
    const payload = (this.payload ?? {}) as Row;
    for (const row of table) {
      if (!matches(row, this.filters)) continue;
      const previous = row.status;
      Object.assign(row, payload, { updated_at: new Date().toISOString() });
      if (this.table === "iptv_users") syncUserStatus(row.id, previous, row.status);
      if (this.table === "subscriptions" && row.status === "activa" && String(row.ends_at) < todayISO()) row.status = "vencida";
      if (["clients", "iptv_users", "subscriptions", "plans", "playlists", "profiles"].includes(this.table)) {
        audit("actualizar", this.table, row.id, { despues: { ...payload } });
      }
    }
    return { data: null, error: null };
  }

  private deleteRows(): Result {
    const table = db[this.table];
    if (!table) return { data: null, error: { message: "Tabla no disponible" } };
    if (this.table === "clients") {
      const doomed = table.filter((row) => matches(row, this.filters)).map((row) => row.id);
      if (db.iptv_users.some((user) => doomed.includes(user.client_id))) {
        return { data: null, error: { message: "No se puede borrar porque hay cuentas relacionadas", code: "23503" } };
      }
    }
    const removed = table.filter((row) => matches(row, this.filters));
    db[this.table] = table.filter((row) => !matches(row, this.filters));
    if (this.table === "playlists") {
      db.channels = db.channels.filter((channel) => !removed.some((list) => list.id === channel.playlist_id));
    }
    for (const row of removed) {
      if (["clients", "iptv_users", "subscriptions", "plans", "playlists", "profiles"].includes(this.table)) {
        audit("eliminar", this.table, row.id, { antes: { ...row } });
      }
    }
    return { data: null, error: null };
  }
}

function createAccount(args: Record<string, unknown>): Result {
  const username = String(args.p_username ?? "");
  const password = String(args.p_password ?? "");
  if (!/^[a-zA-Z0-9._-]{4,32}$/.test(username)) {
    return { data: null, error: { message: "El usuario debe tener entre 4 y 32 caracteres (letras, números, punto o guion)" } };
  }
  if (password.length < 6) return { data: null, error: { message: "La contraseña de la línea debe tener al menos 6 caracteres" } };
  if (String(args.p_ends) < String(args.p_starts)) return { data: null, error: { message: "La fecha de fin no puede ser anterior al inicio" } };
  if (db.iptv_users.some((user) => user.username === username)) return { data: null, error: { message: "Ese usuario ya existe", code: "23505" } };
  const plan = db.plans.find((item) => item.id === args.p_plan_id && item.active);
  if (!plan) return { data: null, error: { message: "El plan no existe o está inactivo" } };

  let clientId = args.p_client_id as string | null;
  if (!clientId) {
    const incoming = (args.p_new_client ?? {}) as Row;
    const name = String(incoming.name ?? "").trim();
    if (name.length < 2) return { data: null, error: { message: "El nombre del cliente es obligatorio" } };
    clientId = crypto.randomUUID();
    db.clients.push({
      id: clientId,
      name,
      phone: String(incoming.phone ?? "").trim() || null,
      email: String(incoming.email ?? "").trim() || null,
      address: String(incoming.address ?? "").trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    audit("crear", "clients", clientId, { name });
  }

  const userId = crypto.randomUUID();
  db.iptv_users.push({
    id: userId,
    client_id: clientId,
    username,
    line_password: password,
    status: "activo",
    notes: String(args.p_notes ?? "").trim() || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  const subId = crypto.randomUUID();
  db.subscriptions.push({
    id: subId,
    iptv_user_id: userId,
    plan_id: args.p_plan_id,
    status: String(args.p_ends) < todayISO() ? "vencida" : "activa",
    starts_at: args.p_starts,
    ends_at: args.p_ends,
    max_connections: args.p_connections,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  audit("crear", "iptv_users", userId, { username });
  return { data: userId, error: null };
}

function renew(args: Record<string, unknown>): Result {
  const plan = db.plans.find((item) => item.id === args.p_plan_id && item.active);
  if (!plan) return { data: null, error: { message: "El plan no existe o está inactivo" } };
  const user = db.iptv_users.find((item) => item.id === args.p_user_id);
  if (!user) return { data: null, error: { message: "La cuenta IPTV no existe" } };
  if (user.status !== "activo") {
    const previous = user.status;
    user.status = "activo";
    syncUserStatus(user.id, previous, "activo");
  }
  const latest = db.subscriptions
    .filter((item) => item.iptv_user_id === user.id)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  let id = "";
  if (!latest || latest.status === "cancelada") {
    id = crypto.randomUUID();
    db.subscriptions.push({
      id,
      iptv_user_id: user.id,
      plan_id: plan.id,
      status: "activa",
      starts_at: todayISO(),
      ends_at: addDays(todayISO(), Number(plan.duration_days)),
      max_connections: plan.max_connections,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } else {
    id = String(latest.id);
    const extend = latest.status === "activa" && String(latest.ends_at) >= todayISO();
    latest.plan_id = plan.id;
    latest.status = "activa";
    latest.starts_at = extend ? latest.starts_at : todayISO();
    latest.ends_at = extend ? addDays(String(latest.ends_at), Number(plan.duration_days)) : addDays(todayISO(), Number(plan.duration_days));
    latest.max_connections = plan.max_connections;
    latest.updated_at = new Date().toISOString();
  }
  for (const sub of db.subscriptions) {
    if (sub.iptv_user_id === user.id && sub.id !== id && ["pendiente", "activa", "suspendida"].includes(String(sub.status))) sub.status = "cancelada";
  }
  audit("actualizar", "subscriptions", id, { despues: { status: "activa", plan_id: plan.id } });
  return { data: id, error: null };
}

export const demoClient = {
  from(table: string) {
    return new Query(table);
  },
  rpc(name: string, args: Record<string, unknown> = {}) {
    if (name === "create_iptv_account") return Promise.resolve(createAccount(args));
    if (name === "renew_subscription") return Promise.resolve(renew(args));
    if (name === "mark_expired_subscriptions") {
      let count = 0;
      for (const sub of db.subscriptions) {
        if (sub.status === "activa" && String(sub.ends_at) < todayISO()) {
          sub.status = "vencida";
          count += 1;
        }
      }
      return Promise.resolve({ data: count, error: null });
    }
    if (name === "channel_groups") {
      const counts = new Map<string, number>();
      for (const channel of db.channels) {
        const title = String(channel.group_title);
        counts.set(title, (counts.get(title) ?? 0) + 1);
      }
      const data = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "es")).map(([group_title, channel_count]) => ({ group_title, channel_count }));
      return Promise.resolve({ data, error: null });
    }
    return Promise.resolve({ data: null, error: { message: "Operación no disponible" } });
  },
  auth: {
    onAuthStateChange(callback: (event: string, next: Session | null) => void) {
      listeners.add(callback);
      callback("INITIAL_SESSION", session);
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      if (email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
        currentUserId = ADMIN_ID;
        session = { user: { id: ADMIN_ID } } as Session;
        sessionStorage.setItem("fibcom-demo-auth", "1");
        emit("SIGNED_IN");
        return { data: { session }, error: null };
      }
      return { data: { session: null }, error: { message: "Invalid login credentials" } };
    },
    async signOut() {
      currentUserId = null;
      session = null;
      sessionStorage.removeItem("fibcom-demo-auth");
      emit("SIGNED_OUT");
      return { error: null };
    },
  },
};
