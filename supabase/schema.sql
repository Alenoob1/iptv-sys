-- Fibcom IPTV
-- Ejecutar completo en el editor SQL de Supabase.
-- La primera cuenta creada en Authentication queda como administrador.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('administrador', 'operador')),
  description text not null
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text,
  role_id uuid not null references public.roles (id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_name_len check (char_length(trim(name)) between 2 and 120),
  constraint client_phone_len check (phone is null or char_length(phone) <= 30),
  constraint client_email_len check (email is null or char_length(email) <= 160),
  constraint client_email_ok check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint client_address_len check (address is null or char_length(address) <= 200)
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  price numeric(10, 2) not null default 0 check (price >= 0),
  duration_days integer not null default 30 check (duration_days > 0),
  max_connections integer not null default 1 check (max_connections > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint plan_name_len check (char_length(trim(name)) between 2 and 80)
);

create table public.iptv_users (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  username text not null unique,
  line_password text not null,
  status text not null default 'activo' check (status in ('activo', 'suspendido', 'inactivo')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-zA-Z0-9._-]{4,32}$'),
  constraint line_password_len check (char_length(line_password) between 6 and 64),
  constraint notes_len check (notes is null or char_length(notes) <= 500)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  iptv_user_id uuid not null references public.iptv_users (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status text not null default 'activa' check (status in ('pendiente', 'activa', 'suspendida', 'vencida', 'cancelada')),
  starts_at date not null,
  ends_at date not null,
  max_connections integer not null check (max_connections > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_dates check (ends_at >= starts_at)
);

create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_label text,
  channel_count integer not null default 0 check (channel_count >= 0),
  imported_at timestamptz not null default now(),
  constraint playlist_name_len check (char_length(trim(name)) between 2 and 80)
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  name text not null,
  group_title text not null default 'General',
  logo_url text,
  stream_url text not null,
  tvg_id text
);

create table public.plan_groups (
  plan_id uuid not null references public.plans (id) on delete cascade,
  group_title text not null,
  primary key (plan_id, group_title)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  record_id uuid,
  detail jsonb not null default '{}'::jsonb
);

create index clients_name_idx on public.clients (name);
create index iptv_users_client_idx on public.iptv_users (client_id);
create index iptv_users_status_idx on public.iptv_users (status);
create index subscriptions_user_idx on public.subscriptions (iptv_user_id);
create index subscriptions_status_idx on public.subscriptions (status, ends_at);
create index channels_playlist_idx on public.channels (playlist_id);
create index channels_group_idx on public.channels (group_title);
create index audit_created_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Funciones de autorización
-- ---------------------------------------------------------------------------

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and p.active = true
      and r.name = 'administrador'
  );
$$;

-- ---------------------------------------------------------------------------
-- Integridad, estados y auditoría
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_touch before update on public.clients
for each row execute function public.touch_updated_at();

create trigger iptv_users_touch before update on public.iptv_users
for each row execute function public.touch_updated_at();

create trigger subscriptions_touch before update on public.subscriptions
for each row execute function public.touch_updated_at();

create or replace function public.enforce_user_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.username is distinct from old.username then
    raise exception 'El usuario de la línea no se puede cambiar';
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not (
      (old.status = 'activo' and new.status in ('suspendido', 'inactivo')) or
      (old.status = 'suspendido' and new.status in ('activo', 'inactivo')) or
      (old.status = 'inactivo' and new.status = 'activo')
    ) then
      raise exception 'Transición de estado no permitida';
    end if;
  end if;

  return new;
end;
$$;

create trigger iptv_users_status before update on public.iptv_users
for each row execute function public.enforce_user_status();

create or replace function public.enforce_subscription_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ends_at < new.starts_at then
    raise exception 'La fecha de fin no puede ser anterior al inicio';
  end if;

  if new.status = 'activa' and new.ends_at < current_date then
    new.status = 'vencida';
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not (
      (old.status = 'pendiente' and new.status in ('activa', 'cancelada')) or
      (old.status = 'activa' and new.status in ('suspendida', 'vencida', 'cancelada')) or
      (old.status = 'suspendida' and new.status in ('activa', 'vencida', 'cancelada')) or
      (old.status = 'vencida' and new.status in ('activa', 'cancelada'))
    ) then
      raise exception 'Transición de suscripción no permitida';
    end if;
  end if;

  return new;
end;
$$;

create trigger subscriptions_status before insert or update on public.subscriptions
for each row execute function public.enforce_subscription_status();

create or replace function public.sync_subscription_with_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'suspendido' then
      update public.subscriptions
      set status = 'suspendida'
      where iptv_user_id = new.id
        and status = 'activa';
    elsif new.status = 'inactivo' then
      update public.subscriptions
      set status = 'cancelada'
      where iptv_user_id = new.id
        and status in ('pendiente', 'activa', 'suspendida', 'vencida');
    elsif new.status = 'activo' and old.status = 'suspendido' then
      update public.subscriptions
      set status = case when ends_at < current_date then 'vencida' else 'activa' end
      where iptv_user_id = new.id
        and status = 'suspendida';
    end if;
  end if;

  return new;
end;
$$;

create trigger iptv_users_sync after update on public.iptv_users
for each row execute function public.sync_subscription_with_user();

create or replace function public.write_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec_id uuid;
  payload jsonb;
  act text;
begin
  if tg_op = 'DELETE' then
    rec_id := old.id;
    payload := to_jsonb(old);
    act := 'eliminar';
  elsif tg_op = 'UPDATE' then
    rec_id := new.id;
    payload := jsonb_build_object('antes', to_jsonb(old), 'despues', to_jsonb(new));
    act := 'actualizar';
  else
    rec_id := new.id;
    payload := to_jsonb(new);
    act := 'crear';
  end if;

  if tg_table_name = 'iptv_users' then
    if tg_op = 'UPDATE' then
      payload := jsonb_build_object(
        'antes', to_jsonb(old) - 'line_password',
        'despues', to_jsonb(new) - 'line_password'
      );
    elsif tg_op = 'DELETE' then
      payload := to_jsonb(old) - 'line_password';
    else
      payload := to_jsonb(new) - 'line_password';
    end if;
  end if;

  insert into public.audit_log (actor_id, action, entity, record_id, detail)
  values (auth.uid(), act, tg_table_name, rec_id, payload);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger clients_audit after insert or update or delete on public.clients
for each row execute function public.write_audit();

create trigger iptv_users_audit after insert or update or delete on public.iptv_users
for each row execute function public.write_audit();

create trigger subscriptions_audit after insert or update or delete on public.subscriptions
for each row execute function public.write_audit();

create trigger plans_audit after insert or update or delete on public.plans
for each row execute function public.write_audit();

create trigger playlists_audit after insert or update or delete on public.playlists
for each row execute function public.write_audit();

create or replace function public.protect_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_is_admin boolean;
  remaining_admins integer;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar el personal';
  end if;

  select r.name = 'administrador' into old_is_admin
  from public.roles r
  where r.id = old.role_id;

  if old_is_admin and old.active and (new.role_id is distinct from old.role_id or new.active = false) then
    select count(*) into remaining_admins
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where r.name = 'administrador'
      and p.active
      and p.id <> old.id;

    if remaining_admins = 0 then
      raise exception 'Debe permanecer al menos un administrador activo';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_protect before update on public.profiles
for each row execute function public.protect_profile();

create trigger profiles_audit after update on public.profiles
for each row execute function public.write_audit();

-- ---------------------------------------------------------------------------
-- Operaciones de negocio
-- ---------------------------------------------------------------------------

create or replace function public.create_iptv_account(
  p_client_id uuid,
  p_new_client jsonb,
  p_username text,
  p_password text,
  p_plan_id uuid,
  p_starts date,
  p_ends date,
  p_connections integer,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
  v_user uuid;
  v_name text;
begin
  if not public.is_staff() then
    raise exception 'No autorizado';
  end if;

  if p_username !~ '^[a-zA-Z0-9._-]{4,32}$' then
    raise exception 'El usuario debe tener entre 4 y 32 caracteres (letras, números, punto o guion)';
  end if;

  if p_password is null or char_length(p_password) < 6 then
    raise exception 'La contraseña de la línea debe tener al menos 6 caracteres';
  end if;

  if p_ends < p_starts then
    raise exception 'La fecha de fin no puede ser anterior al inicio';
  end if;

  if p_connections is null or p_connections < 1 then
    raise exception 'Las conexiones deben ser al menos 1';
  end if;

  if not exists (select 1 from public.plans where id = p_plan_id and active) then
    raise exception 'El plan no existe o está inactivo';
  end if;

  if p_client_id is not null then
    select id into v_client from public.clients where id = p_client_id;
    if v_client is null then
      raise exception 'El cliente no existe';
    end if;
  else
    v_name := trim(coalesce(p_new_client->>'name', ''));
    if char_length(v_name) < 2 then
      raise exception 'El nombre del cliente es obligatorio';
    end if;

    insert into public.clients (name, phone, email, address)
    values (
      v_name,
      nullif(trim(coalesce(p_new_client->>'phone', '')), ''),
      nullif(trim(coalesce(p_new_client->>'email', '')), ''),
      nullif(trim(coalesce(p_new_client->>'address', '')), '')
    )
    returning id into v_client;
  end if;

  insert into public.iptv_users (client_id, username, line_password, status, notes)
  values (
    v_client,
    p_username,
    p_password,
    'activo',
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id into v_user;

  insert into public.subscriptions (iptv_user_id, plan_id, status, starts_at, ends_at, max_connections)
  values (v_user, p_plan_id, 'activa', p_starts, p_ends, p_connections);

  return v_user;
end;
$$;

create or replace function public.renew_subscription(p_user_id uuid, p_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer;
  v_conn integer;
  v_sub_id uuid;
  v_sub_status text;
  v_sub_start date;
  v_sub_end date;
  v_start date;
  v_end date;
  v_user_status text;
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'No autorizado';
  end if;

  select duration_days, max_connections into v_days, v_conn
  from public.plans
  where id = p_plan_id
    and active;

  if v_days is null then
    raise exception 'El plan no existe o está inactivo';
  end if;

  select status into v_user_status from public.iptv_users where id = p_user_id;
  if v_user_status is null then
    raise exception 'La cuenta IPTV no existe';
  end if;

  if v_user_status <> 'activo' then
    update public.iptv_users set status = 'activo' where id = p_user_id;
  end if;

  select id, status, starts_at, ends_at
  into v_sub_id, v_sub_status, v_sub_start, v_sub_end
  from public.subscriptions
  where iptv_user_id = p_user_id
  order by created_at desc
  limit 1;

  if not found or v_sub_status = 'cancelada' then
    insert into public.subscriptions (iptv_user_id, plan_id, status, starts_at, ends_at, max_connections)
    values (p_user_id, p_plan_id, 'activa', current_date, current_date + v_days, v_conn)
    returning id into v_id;
  else
    if v_sub_status = 'activa' and v_sub_end >= current_date then
      v_start := v_sub_start;
      v_end := v_sub_end + v_days;
    else
      v_start := current_date;
      v_end := current_date + v_days;
    end if;

    update public.subscriptions
    set plan_id = p_plan_id,
        status = 'activa',
        starts_at = v_start,
        ends_at = v_end,
        max_connections = v_conn
    where id = v_sub_id
    returning id into v_id;
  end if;

  update public.subscriptions
  set status = 'cancelada'
  where iptv_user_id = p_user_id
    and id <> v_id
    and status in ('pendiente', 'activa', 'suspendida');

  return v_id;
end;
$$;

create or replace function public.mark_expired_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.is_staff() then
    raise exception 'No autorizado';
  end if;

  update public.subscriptions
  set status = 'vencida'
  where status = 'activa'
    and ends_at < current_date;

  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.channel_groups()
returns table (group_title text, channel_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select c.group_title, count(*)::bigint
  from public.channels c
  group by c.group_title
  order by c.group_title;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_role uuid;
  operator_role uuid;
  assigned uuid;
  is_first boolean;
begin
  select id into admin_role from public.roles where name = 'administrador';
  select id into operator_role from public.roles where name = 'operador';
  select not exists (select 1 from public.profiles) into is_first;
  assigned := case when is_first then admin_role else operator_role end;

  insert into public.profiles (id, full_name, email, role_id, active)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(coalesce(new.email, 'personal'), '@', 1)),
    new.email,
    assigned,
    true
  );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Datos iniciales
-- ---------------------------------------------------------------------------

insert into public.roles (name, description) values
  ('administrador', 'Control total del panel, listas, roles y auditoría'),
  ('operador', 'Gestión de clientes, cuentas IPTV y suscripciones');

insert into public.permissions (code, name) values
  ('clientes.gestionar', 'Registrar y editar clientes'),
  ('usuarios.gestionar', 'Registrar y editar cuentas IPTV'),
  ('suscripciones.gestionar', 'Gestionar planes contratados'),
  ('listas.gestionar', 'Importar listas M3U'),
  ('reportes.ver', 'Consultar reportes'),
  ('roles.gestionar', 'Asignar roles del personal'),
  ('auditoria.ver', 'Consultar historial');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'administrador';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'clientes.gestionar',
  'usuarios.gestionar',
  'suscripciones.gestionar',
  'reportes.ver'
)
where r.name = 'operador';

insert into public.plans (name, description, price, duration_days, max_connections) values
  ('Básico', 'Un dispositivo, vigencia de 30 días', 150, 30, 1),
  ('Familiar', 'Hasta tres dispositivos, vigencia de 30 días', 220, 30, 3),
  ('Premium', 'Dos dispositivos y acceso a todos los grupos asignados', 190, 30, 2);

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Vista de consulta
-- ---------------------------------------------------------------------------

create view public.iptv_directory with (security_invoker = true) as
select
  u.id,
  u.username,
  u.line_password,
  u.status,
  u.notes,
  u.created_at,
  u.client_id,
  c.name as client_name,
  c.phone as client_phone,
  c.email as client_email,
  c.address as client_address,
  s.id as subscription_id,
  s.status as subscription_status,
  s.starts_at,
  s.ends_at,
  s.max_connections,
  s.plan_id,
  p.name as plan_name,
  p.duration_days
from public.iptv_users u
join public.clients c on c.id = u.client_id
left join lateral (
  select *
  from public.subscriptions sub
  where sub.iptv_user_id = u.id
  order by sub.created_at desc
  limit 1
) s on true
left join public.plans p on p.id = s.plan_id;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.plans enable row level security;
alter table public.iptv_users enable row level security;
alter table public.subscriptions enable row level security;
alter table public.playlists enable row level security;
alter table public.channels enable row level security;
alter table public.plan_groups enable row level security;
alter table public.audit_log enable row level security;

create policy roles_select on public.roles
for select to authenticated using ((select public.is_staff()));

create policy permissions_select on public.permissions
for select to authenticated using ((select public.is_staff()));

create policy role_permissions_select on public.role_permissions
for select to authenticated using ((select public.is_staff()));

create policy profiles_select on public.profiles
for select to authenticated using ((select public.is_staff()));

create policy profiles_update on public.profiles
for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy clients_select on public.clients
for select to authenticated using ((select public.is_staff()));

create policy clients_insert on public.clients
for insert to authenticated with check ((select public.is_staff()));

create policy clients_update on public.clients
for update to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

create policy clients_delete on public.clients
for delete to authenticated using ((select public.is_admin()));

create policy plans_select on public.plans
for select to authenticated using ((select public.is_staff()));

create policy plans_write on public.plans
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy iptv_select on public.iptv_users
for select to authenticated using ((select public.is_staff()));

create policy iptv_insert on public.iptv_users
for insert to authenticated with check ((select public.is_staff()));

create policy iptv_update on public.iptv_users
for update to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

create policy subscriptions_select on public.subscriptions
for select to authenticated using ((select public.is_staff()));

create policy subscriptions_insert on public.subscriptions
for insert to authenticated with check ((select public.is_staff()));

create policy subscriptions_update on public.subscriptions
for update to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

create policy playlists_select on public.playlists
for select to authenticated using ((select public.is_staff()));

create policy playlists_write on public.playlists
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy channels_select on public.channels
for select to authenticated using ((select public.is_staff()));

create policy channels_write on public.channels
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy plan_groups_select on public.plan_groups
for select to authenticated using ((select public.is_staff()));

create policy plan_groups_write on public.plan_groups
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy audit_select on public.audit_log
for select to authenticated using ((select public.is_admin()));

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.iptv_directory to authenticated;
revoke all on all tables in schema public from anon;
revoke all on public.iptv_directory from anon;

revoke all on all functions in schema public from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.create_iptv_account(uuid, jsonb, text, text, uuid, date, date, integer, text) to authenticated;
grant execute on function public.renew_subscription(uuid, uuid) to authenticated;
grant execute on function public.mark_expired_subscriptions() to authenticated;
grant execute on function public.channel_groups() to authenticated;
