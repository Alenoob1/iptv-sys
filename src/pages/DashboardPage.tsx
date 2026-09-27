import { useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Banner, Glyph, Loading, StatusBadge, useTitle } from "../components/ui";
import { addDays, dueLabel, formatDate, todayISO } from "../lib/format";
import { humanError } from "../lib/rules";
import { supabase } from "../lib/supabase";
import type { DirectoryRow } from "../types";

type Counts = {
  clients: number;
  open: number;
  expiring: number;
  capacity: number;
  ready: number;
  offline: number;
};

type Range = "semana" | "dia" | "hora";
type Point = { label: string; value: number };

const ranges: { id: Range; label: string }[] = [
  { id: "semana", label: "Semana" },
  { id: "dia", label: "Día" },
  { id: "hora", label: "Hora" },
];

function greeting(name: string) {
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  return `${hello}, ${name.split(" ")[0] || name}`;
}

function todayLabel() {
  const label = new Intl.DateTimeFormat("es-GT", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function isoDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function clock(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function inService(row: DirectoryRow, day: string) {
  return row.status === "activo"
    && row.subscription_status === "activa"
    && !!row.starts_at
    && !!row.ends_at
    && row.starts_at.slice(0, 10) <= day
    && row.ends_at.slice(0, 10) >= day;
}

function seriesFor(rows: DirectoryRow[], range: Range): Point[] {
  const now = new Date();
  if (range === "hora") {
    return Array.from({ length: 12 }, (_, index) => {
      const time = new Date(now.getTime() - (11 - index) * 5 * 60 * 1000);
      return { label: clock(time), value: rows.filter((row) => inService(row, isoDay(time))).length };
    });
  }
  if (range === "dia") {
    return Array.from({ length: 24 }, (_, index) => {
      const time = new Date(now);
      time.setMinutes(0, 0, 0);
      time.setHours(time.getHours() - (23 - index));
      return { label: index % 3 === 0 ? clock(time) : "", value: rows.filter((row) => inService(row, isoDay(time))).length };
    });
  }
  return Array.from({ length: 14 }, (_, index) => {
    const time = new Date(now);
    time.setDate(time.getDate() - (13 - index));
    const label = index % 2 === 0 ? new Intl.DateTimeFormat("es-GT", { day: "numeric", month: "short" }).format(time) : "";
    return { label, value: rows.filter((row) => inService(row, isoDay(time))).length };
  });
}

function ConnectionsChart({ points }: { points: Point[] }) {
  const gradientId = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const width = 980;
  const height = 250;
  const pad = { l: 42, r: 16, t: 18, b: 32 };
  const peak = Math.max(0, ...points.map((point) => point.value));
  const max = Math.max(2, peak + 1);
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const coords = points.map((point, index) => {
    const x = pad.l + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
    const y = pad.t + innerH - (point.value / max) * innerH;
    return { ...point, x, y };
  });
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];
  const first = coords[0];
  const base = pad.t + innerH;
  const area = first && last ? `${line} L${last.x.toFixed(1)},${base} L${first.x.toFixed(1)},${base} Z` : "";
  const ticks = Array.from({ length: max + 1 }, (_, value) => value).filter((value) => max <= 8 || value % Math.ceil(max / 6) === 0 || value === max);
  const active = hover === null ? null : coords[hover];

  return (
    <svg
      className="conn-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Líneas en servicio"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * width;
        let nearest = 0;
        coords.forEach((point, index) => {
          if (Math.abs(point.x - x) < Math.abs((coords[nearest]?.x ?? 0) - x)) nearest = index;
        });
        setHover(nearest);
      }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#e0f6ff" stopOpacity="0.72" />
        </linearGradient>
      </defs>
      {ticks.map((tick) => {
        const y = pad.t + innerH - (tick / max) * innerH;
        return (
          <g key={tick}>
            <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} className="conn-grid" />
            <text x={pad.l - 8} y={y + 4} className="conn-label" textAnchor="end">{tick}</text>
          </g>
        );
      })}
      {coords.map((point, index) => point.label ? (
        <text key={`${point.label}-${index}`} x={point.x} y={height - 8} className="conn-label" textAnchor="middle">{point.label}</text>
      ) : null)}
      <path className="conn-area" d={area} fill={`url(#${gradientId})`} />
      <path className="conn-line" d={line} />
      {active ? (
        <g>
          <line x1={active.x} x2={active.x} y1={pad.t} y2={base} className="conn-guide" />
          <circle cx={active.x} cy={active.y} r="4.5" className="conn-dot" />
          <text x={active.x} y={Math.max(pad.t + 12, active.y - 10)} className="conn-value" textAnchor="middle">{active.value}</text>
        </g>
      ) : null}
    </svg>
  );
}

export function DashboardPage() {
  useTitle("Resumen");
  const { profile } = useAuth();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [range, setRange] = useState<Range>("semana");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const marked = await supabase.rpc("mark_expired_subscriptions");
      if (marked.error) {
        if (!cancelled) setError(humanError(marked.error));
        return;
      }
      const [clients, channels, directory] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("channels").select("stream_url").range(0, 499),
        supabase.from("iptv_directory").select("*").order("created_at", { ascending: false }).limit(500),
      ]);
      const failed = [clients, channels, directory].find((result) => result.error);
      if (cancelled) return;
      if (failed?.error) {
        setError(humanError(failed.error));
        return;
      }
      const directoryRows = (directory.data ?? []) as DirectoryRow[];
      const today = todayISO();
      const soon = addDays(today, 7);
      const serving = directoryRows.filter((row) => inService(row, today));
      const channelRows = (channels.data ?? []) as { stream_url: string }[];
      const ready = channelRows.filter((channel) => channel.stream_url.startsWith("http")).length;
      setRows(directoryRows);
      setCounts({
        clients: clients.count ?? 0,
        open: serving.length,
        expiring: directoryRows.filter((row) => row.subscription_status === "activa" && !!row.ends_at && row.ends_at.slice(0, 10) >= today && row.ends_at.slice(0, 10) <= soon).length,
        capacity: serving.reduce((sum, row) => sum + (row.max_connections ?? 0), 0),
        ready,
        offline: channelRows.length - ready,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const points = useMemo(() => seriesFor(rows, range), [rows, range]);
  const today = todayISO();
  const soon = addDays(today, 7);
  const expiring = rows.filter((row) => row.subscription_status === "activa" && !!row.ends_at && row.ends_at.slice(0, 10) >= today && row.ends_at.slice(0, 10) <= soon).slice(0, 6);
  const recent = rows.slice(0, 6);
  const activePoint = points[points.length - 1]?.value ?? 0;

  return (
    <section className="dashboard">
      <header className="dash-head">
        <div>
          <p className="kicker">{todayLabel()}</p>
          <h1>{greeting(profile?.full_name ?? "equipo")}</h1>
          <p>Líneas en servicio según su vigencia. No es un monitoreo en vivo.</p>
        </div>
        <div className="dash-actions">
          <Link className="btn search" to="/reportes"><Glyph name="search" /> Reportes</Link>
          <Link className="btn add" to="/cuentas"><Glyph name="plus" /> Generar cuenta</Link>
        </div>
      </header>
      {error ? <Banner kind="error">{error}</Banner> : null}
      {!counts ? <Loading /> : (
        <>
          <div className="stat-row">
            <Link className="stat s1" to="/conexiones">
              <span className="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 4 7.5 12 12l8-4.5L12 3Z" /><path d="M4 12.5 12 17l8-4.5M4 16.5 12 21l8-4.5" /></svg></span>
              <span className="stat-copy"><strong>{counts.open}</strong><small>Conexiones</small></span>
            </Link>
            <Link className="stat s2" to="/clientes">
              <span className="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M16 20v-1.4A3.6 3.6 0 0 0 12.4 15H7.6A3.6 3.6 0 0 0 4 18.6V20" /><circle cx="10" cy="8" r="3" /><path d="M19 20v-1.2A3 3 0 0 0 16.5 16M16 5.2a3 3 0 0 1 0 5.6" /></svg></span>
              <span className="stat-copy"><strong>{counts.clients}</strong><small>Usuarios</small></span>
            </Link>
            <Link className="stat s3" to="/reportes">
              <span className="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 4v11" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></svg></span>
              <span className="stat-copy"><strong>{counts.expiring}</strong><small>Por vencer</small></span>
            </Link>
            <Link className="stat s4" to="/cuentas">
              <span className="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 20V9" /><path d="m7 13 5-5 5 5" /><path d="M5 4h14" /></svg></span>
              <span className="stat-copy"><strong>{counts.capacity}</strong><small>Capacidad</small></span>
            </Link>
            <Link className="stat s5" to="/listas">
              <span className="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="m10 9 5 3-5 3V9Z" /></svg></span>
              <span className="stat-copy"><strong>{counts.ready}</strong><small>Con enlace</small></span>
            </Link>
            <Link className="stat s6" to="/listas">
              <span className="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="m9 9 6 6M15 9l-6 6" /></svg></span>
              <span className="stat-copy"><strong>{counts.offline}</strong><small>Sin enlace</small></span>
            </Link>
          </div>
          <article className="conn-card">
            <div className="conn-head">
              <div>
                <h2>Conexiones</h2>
                <p>{activePoint} en servicio ahora</p>
              </div>
              <div className="range-switch" role="group" aria-label="Rango del gráfico">
                {ranges.map((item) => (
                  <button key={item.id} type="button" className={range === item.id ? "on" : ""} onClick={() => setRange(item.id)}>{item.label}</button>
                ))}
              </div>
            </div>
            <ConnectionsChart key={range} points={points} />
          </article>
          <article className="server-card">
            <header>
              <strong>Servidor principal</strong>
              <span>
                <Link to="/cuentas" aria-label="Ver cuentas">▶</Link>
                <Link to="/cuentas" aria-label="Buscar cuentas"><Glyph name="search" /></Link>
              </span>
            </header>
            <div>
              <p><span>Capacidad</span><strong>{counts.capacity}</strong></p>
              <p><span>En servicio</span><strong>{counts.open}</strong></p>
              <p><span>Usuarios</span><strong>{counts.clients}</strong></p>
            </div>
          </article>
          <div className="dash-grid">
            <article className="card">
              <div className="card-title">
                <h2>Vencen esta semana</h2>
                <Link to="/cuentas">Ver cuentas</Link>
              </div>
              {expiring.length === 0 ? <p className="hint">Ninguna suscripción activa vence en los próximos 7 días.</p> : (
                <ul className="queue">
                  {expiring.map((row) => (
                    <li key={row.id}>
                      <Link to={`/cuentas/${row.id}`}>
                        <strong>{row.client_name}</strong>
                        <small>{row.username} · {row.plan_name ?? "Sin plan"}</small>
                      </Link>
                      <em>{dueLabel(row.ends_at)}</em>
                    </li>
                  ))}
                </ul>
              )}
            </article>
            <article className="card">
              <div className="card-title">
                <h2>Cuentas recientes</h2>
                <Link to="/cuentas">Administrar</Link>
              </div>
              {recent.length === 0 ? <p className="hint">Todavía no hay cuentas.</p> : (
                <div className="table-wrap flat">
                  <table>
                    <thead>
                      <tr><th>Cliente</th><th>Usuario</th><th>Estado</th><th>Alta</th></tr>
                    </thead>
                    <tbody>
                      {recent.map((row) => (
                        <tr key={row.id}>
                          <td><Link to={`/cuentas/${row.id}`}>{row.client_name}</Link></td>
                          <td>{row.username}</td>
                          <td><StatusBadge value={row.status} /></td>
                          <td>{formatDate(row.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </div>
        </>
      )}
    </section>
  );
}
