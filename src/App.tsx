import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { Layout } from "./components/Layout";
import { Loading } from "./components/ui";
import { AuditPage } from "./pages/AuditPage";
import { ClientsPage } from "./pages/ClientsPage";
import { ConnectionsPage } from "./pages/ConnectionsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { PlansPage } from "./pages/PlansPage";
import { PlaylistsPage } from "./pages/PlaylistsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { StaffPage } from "./pages/StaffPage";
import { UserDetailPage } from "./pages/UserDetailPage";
import { UsersPage } from "./pages/UsersPage";

function RequireAuth() {
  const { ready, session, profile, profileState } = useAuth();
  if (!ready || (session && profileState !== "ready" && profileState !== "missing")) return <Loading label="Abriendo el panel…" />;
  if (!session) return <Navigate to="/ingreso" replace />;
  if (profileState === "missing" || !profile) {
    return (
      <section className="auth-screen">
        <div className="auth-card">
          <h1>No hay perfil para esta cuenta</h1>
          <p>Ejecuta el archivo supabase/schema.sql y vuelve a crear el usuario en Authentication. La primera cuenta queda como administrador.</p>
        </div>
      </section>
    );
  }
  return <Outlet />;
}

function RequireAdmin() {
  const { profile } = useAuth();
  if (profile?.role !== "administrador") return <Navigate to="/" replace />;
  return <Outlet />;
}

export function App() {
  return (
    <Routes>
      <Route path="/ingreso" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="clientes" element={<ClientsPage />} />
          <Route path="conexiones" element={<ConnectionsPage />} />
          <Route path="cuentas" element={<UsersPage />} />
          <Route path="cuentas/:id" element={<UserDetailPage />} />
          <Route path="planes" element={<PlansPage />} />
          <Route path="reportes" element={<ReportsPage />} />
          <Route element={<RequireAdmin />}>
            <Route path="listas" element={<PlaylistsPage />} />
            <Route path="historial" element={<AuditPage />} />
            <Route path="personal" element={<StaffPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
