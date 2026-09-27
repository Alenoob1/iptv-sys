import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { isConfigured } from "../lib/supabase";

type NavItem = { to: string; label: string; end?: boolean; icon: IconName };

const links: NavItem[] = [
  { to: "/", label: "Resumen", end: true, icon: "home" },
  { to: "/conexiones", label: "Conexiones", icon: "pulse" },
  { to: "/clientes", label: "Clientes", icon: "users" },
  { to: "/cuentas", label: "Cuentas", icon: "tv" },
  { to: "/planes", label: "Planes", icon: "layers" },
  { to: "/reportes", label: "Reportes", icon: "chart" },
];

const adminLinks: NavItem[] = [
  { to: "/listas", label: "Listas M3U", icon: "list" },
  { to: "/historial", label: "Historial", icon: "clock" },
  { to: "/personal", label: "Personal", icon: "shield" },
];

type IconName = "home" | "users" | "tv" | "layers" | "chart" | "list" | "clock" | "shield" | "pulse";

function Icon({ name }: { name: IconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "home") return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" /></svg>;
  if (name === "pulse") return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M3 12h4l2-5 4 10 2-5h6" /></svg>;
  if (name === "users") return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20M16 11a3 3 0 1 0 0-6M8 11a3 3 0 1 0 0-6" /></svg>;
  if (name === "tv") return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 7h16v10H4zM8 21h8M12 17v4" /></svg>;
  if (name === "layers") return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m12 4 8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4" /></svg>;
  if (name === "chart") return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 19h16M7 16V9M12 16V5M17 16v-4" /></svg>;
  if (name === "list") return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" /></svg>;
  if (name === "clock") return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v6l4 2" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 3 5 6v6c0 4.2 2.8 7.4 7 9 4.2-1.6 7-4.8 7-9V6z" /></svg>;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "FC";
}

export function Layout() {
  const { profile, signOut } = useAuth();
  const items = profile?.role === "administrador" ? [...links, ...adminLinks] : links;
  const name = profile?.full_name ?? "Personal";
  const path = useLocation().pathname;
  const dark = path === "/" || path === "/cuentas" || path === "/listas" || path === "/conexiones";

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="mark"><Icon name="tv" /></span>
          <div>
            <strong>Fibcom</strong>
            <small>IPTV</small>
          </div>
        </div>
        <nav>
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end ?? false} title={item.label} className={({ isActive }) => (isActive ? "active" : undefined)}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className={dark ? "workspace panel-dark" : "workspace"}>
        <header className="topbar">
          <div className="topbar-title">
            <strong>Gestión IPTV</strong>
            {isConfigured ? null : <span className="chip">Vista previa</span>}
          </div>
          <div className="topbar-user">
            <span className="avatar" aria-hidden="true">{initials(name)}</span>
            <div>
              <strong>{name}</strong>
              <small>{profile?.role === "administrador" ? "Administrador" : "Operador"}</small>
            </div>
            <button type="button" className="btn small" onClick={() => void signOut()}>Salir</button>
          </div>
        </header>
        <main className={dark ? "main panel-main" : "main"}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
