export type RoleName = "administrador" | "operador";
export type UserStatus = "activo" | "suspendido" | "inactivo";
export type SubStatus = "pendiente" | "activa" | "suspendida" | "vencida" | "cancelada";

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  active: boolean;
  role_id: string;
  role: RoleName;
};

export type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
};

export type Plan = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  duration_days: number;
  max_connections: number;
  active: boolean;
  created_at: string;
};

export type DirectoryRow = {
  id: string;
  username: string;
  line_password: string;
  status: UserStatus;
  notes: string | null;
  created_at: string;
  client_id: string;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  client_address: string | null;
  subscription_id: string | null;
  subscription_status: SubStatus | null;
  starts_at: string | null;
  ends_at: string | null;
  max_connections: number | null;
  plan_id: string | null;
  plan_name: string | null;
  duration_days: number | null;
};

export type Subscription = {
  id: string;
  iptv_user_id: string;
  plan_id: string;
  status: SubStatus;
  starts_at: string;
  ends_at: string;
  max_connections: number;
  created_at: string;
};

export type Playlist = {
  id: string;
  name: string;
  source_label: string | null;
  channel_count: number;
  imported_at: string;
};

export type Channel = {
  name: string;
  group_title: string;
  logo_url: string | null;
  stream_url: string;
  tvg_id: string | null;
};

export type AuditRow = {
  id: string;
  created_at: string;
  actor_id: string | null;
  action: string;
  entity: string;
  record_id: string | null;
  detail: Record<string, unknown>;
};

export type StaffRow = {
  id: string;
  full_name: string;
  email: string | null;
  role_id: string;
  active: boolean;
  created_at: string;
};

export type RoleRow = {
  id: string;
  name: RoleName;
  description: string;
};
