-- ============================================================
-- RestoPanel · Migration 0014 — Enterprise RBAC + User Profiles + Sessions
-- ============================================================
-- This migration transforms RestoPanel from a simple ADMIN/STAFF
-- role system into a full Enterprise RBAC (Role-Based Access Control)
-- architecture with:
--
--   1. roles table — definable roles (SuperAdmin, Owner, Manager,
--      Reception, Staff, Kitchen, Bar, Marketing, Accountant)
--   2. permissions table — granular permissions
--   3. role_permissions — many-to-many mapping
--   4. user_roles — users assigned to roles within an organization
--   5. user_profiles — extended user data (avatar, language, timezone)
--   6. user_sessions — active session tracking for remote logout
--   7. user_activity — audit trail of user actions
--   8. subscription_plans — architecture ready for Stripe (Phase 2)
--   9. organization_subscriptions — links orgs to plans
--
-- All existing functionality is preserved. The old `users.role`
-- column is kept for backward compatibility — new code reads from
-- `user_roles` instead.
-- ============================================================

-- ============================================================
-- 1. ROLES — definable, stored in DB (no code changes needed to add)
-- ============================================================
create table if not exists roles (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  label           text not null,
  description     text,
  is_system       boolean not null default false,  -- system roles can't be deleted
  organization_id uuid references organizations(id) on delete cascade,  -- NULL = global role
  created_at      timestamptz not null default now()
);

create index if not exists roles_organization_id_idx on roles(organization_id) where organization_id is not null;

alter table roles enable row level security;
drop policy if exists roles_tenant_select on roles;
create policy roles_tenant_select on roles
  for select using (organization_id = current_user_org_id() or organization_id is null);
drop policy if exists roles_tenant_insert on roles;
create policy roles_tenant_insert on roles
  for insert with check (organization_id = current_user_org_id());
drop policy if exists roles_tenant_update on roles;
create policy roles_tenant_update on roles
  for update using (organization_id = current_user_org_id());
drop policy if exists roles_super_admin_all on roles;
create policy roles_super_admin_all on roles
  for all using (is_current_user_super_admin()) with check (true);

-- ============================================================
-- 2. PERMISSIONS — granular actions
-- ============================================================
create table if not exists permissions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,  -- e.g. 'reservations.create', 'menu.edit', 'reports.view'
  label       text not null,
  module      text not null,  -- 'reservations', 'tables', 'crm', 'menu', 'analytics', 'admin', etc.
  description text,
  created_at  timestamptz not null default now()
);

alter table permissions enable row level security;
drop policy if exists permissions_select on permissions;
create policy permissions_select on permissions for select using (true);  -- permissions are global, readable by all authenticated

-- ============================================================
-- 3. ROLE_PERMISSIONS — many-to-many
-- ============================================================
create table if not exists role_permissions (
  role_id       uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

alter table role_permissions enable row level security;
drop policy if exists role_permissions_select on role_permissions;
create policy role_permissions_select on role_permissions
  for select using (
    exists (select 1 from roles r where r.id = role_id and (r.organization_id = current_user_org_id() or r.organization_id is null or is_current_user_super_admin()))
  );

-- ============================================================
-- 4. USER_ROLES — assign roles to users within an organization
-- ============================================================
create table if not exists user_roles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  role_id         uuid not null references roles(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  assigned_by     uuid references users(id) on delete set null,
  assigned_at     timestamptz not null default now(),
  unique (user_id, organization_id)  -- one role per user per org
);

create index if not exists user_roles_user_id_idx on user_roles(user_id);
create index if not exists user_roles_organization_id_idx on user_roles(organization_id);

alter table user_roles enable row level security;
drop policy if exists user_roles_tenant_select on user_roles;
create policy user_roles_tenant_select on user_roles
  for select using (organization_id = current_user_org_id());
drop policy if exists user_roles_tenant_insert on user_roles;
create policy user_roles_tenant_insert on user_roles
  for insert with check (organization_id = current_user_org_id());
drop policy if exists user_roles_tenant_update on user_roles;
create policy user_roles_tenant_update on user_roles
  for update using (organization_id = current_user_org_id());
drop policy if exists user_roles_tenant_delete on user_roles;
create policy user_roles_tenant_delete on user_roles
  for delete using (organization_id = current_user_org_id());
drop policy if exists user_roles_super_admin_all on user_roles;
create policy user_roles_super_admin_all on user_roles
  for all using (is_current_user_super_admin()) with check (true);

-- ============================================================
-- 5. USER_PROFILES — extended user data
-- ============================================================
create table if not exists user_profiles (
  user_id         uuid primary key references users(id) on delete cascade,
  avatar_url      text,
  language        text not null default 'es',
  timezone        text not null default 'Europe/Madrid',
  preferences     jsonb not null default '{}'::jsonb,  -- flexible key-value store
  last_login_at   timestamptz,
  last_login_ip   text,
  last_user_agent text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table user_profiles enable row level security;
drop policy if exists user_profiles_self_select on user_profiles;
create policy user_profiles_self_select on user_profiles
  for select using (
    user_id::text = current_setting('request.jwt.claim.sub', true)
    or exists (select 1 from users u where u.id = user_id and u.organization_id = current_user_org_id())
    or is_current_user_super_admin()
  );
drop policy if exists user_profiles_self_update on user_profiles;
create policy user_profiles_self_update on user_profiles
  for update using (
    user_id::text = current_setting('request.jwt.claim.sub', true)
    or is_current_user_super_admin()
  );
drop policy if exists user_profiles_tenant_insert on user_profiles;
create policy user_profiles_tenant_insert on user_profiles
  for insert with check (
    exists (select 1 from users u where u.id = user_id and u.organization_id = current_user_org_id())
    or is_current_user_super_admin()
  );

-- Trigger for updated_at
drop trigger if exists user_profiles_touch on user_profiles;
create trigger user_profiles_touch
  before update on user_profiles
  for each row execute function touch_updated_at();

-- ============================================================
-- 6. USER_SESSIONS — active session tracking
-- ============================================================
create table if not exists user_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  token_jti       text not null unique,  -- JWT ID for remote invalidation
  device_info     text,                   -- User-Agent
  ip_address      text,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  revoked_at      timestamptz,            -- NULL = active, non-NULL = revoked
  last_activity   timestamptz not null default now()
);

create index if not exists user_sessions_user_id_idx on user_sessions(user_id);
create index if not exists user_sessions_token_jti_idx on user_sessions(token_jti);
create index if not exists user_sessions_active_idx on user_sessions(user_id) where revoked_at is null;

alter table user_sessions enable row level security;
drop policy if exists user_sessions_self_select on user_sessions;
create policy user_sessions_self_select on user_sessions
  for select using (
    user_id::text = current_setting('request.jwt.claim.sub', true)
    or is_current_user_super_admin()
  );
drop policy if exists user_sessions_self_insert on user_sessions;
create policy user_sessions_self_insert on user_sessions
  for insert with check (
    user_id::text = current_setting('request.jwt.claim.sub', true)
    or is_current_user_super_admin()
  );
drop policy if exists user_sessions_self_update on user_sessions;
create policy user_sessions_self_update on user_sessions
  for update using (
    user_id::text = current_setting('request.jwt.claim.sub', true)
    or is_current_user_super_admin()
  );

-- ============================================================
-- 7. USER_ACTIVITY — audit trail
-- ============================================================
create table if not exists user_activity (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  action          text not null,           -- 'login', 'logout', 'create_reservation', etc.
  entity_type     text,                    -- 'reservation', 'table', 'customer', etc.
  entity_id       text,
  details         jsonb,
  ip_address      text,
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index if not exists user_activity_user_id_idx on user_activity(user_id);
create index if not exists user_activity_organization_id_idx on user_activity(organization_id);
create index if not exists user_activity_created_at_idx on user_activity(created_at desc);
create index if not exists user_activity_action_idx on user_activity(action);

alter table user_activity enable row level security;
drop policy if exists user_activity_tenant_select on user_activity;
create policy user_activity_tenant_select on user_activity
  for select using (organization_id = current_user_org_id() or is_current_user_super_admin());
drop policy if exists user_activity_self_insert on user_activity;
create policy user_activity_self_insert on user_activity
  for insert with check (true);  -- any authenticated user can log their own activity

-- ============================================================
-- 8. SUBSCRIPTION_PLANS — architecture for Phase 2 (Stripe)
-- ============================================================
create table if not exists subscription_plans (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,     -- 'starter', 'professional', 'enterprise'
  label           text not null,            -- 'Starter', 'Professional', 'Enterprise'
  description     text,
  price_monthly   numeric(10,2) not null default 0,   -- EUR per month
  price_yearly    numeric(10,2) not null default 0,   -- EUR per year
  max_tables      int,                      -- NULL = unlimited
  max_users       int,                      -- NULL = unlimited
  max_reservations int,                     -- NULL = unlimited (per month)
  features        jsonb not null default '{}'::jsonb,  -- feature flags
  is_active       boolean not null default true,
  stripe_price_id_monthly text,             -- for Phase 2
  stripe_price_id_yearly text,              -- for Phase 2
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table subscription_plans enable row level security;
drop policy if exists subscription_plans_select on subscription_plans;
create policy subscription_plans_select on subscription_plans
  for select using (true);  -- plans are public

-- ============================================================
-- 9. ORGANIZATION_SUBSCRIPTIONS — links orgs to plans
-- ============================================================
create table if not exists organization_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_id         uuid not null references subscription_plans(id),
  billing_cycle   text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly')),
  status          text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'canceled', 'paused')),
  trial_ends_at   timestamptz,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  stripe_customer_id    text,  -- for Phase 2
  stripe_subscription_id text, -- for Phase 2
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id)  -- one subscription per org
);

create index if not exists org_subscriptions_org_idx on organization_subscriptions(organization_id);

alter table organization_subscriptions enable row level security;
drop policy if exists org_subscriptions_tenant_select on organization_subscriptions;
create policy org_subscriptions_tenant_select on organization_subscriptions
  for select using (organization_id = current_user_org_id());
drop policy if exists org_subscriptions_super_admin_all on organization_subscriptions;
create policy org_subscriptions_super_admin_all on organization_subscriptions
  for all using (is_current_user_super_admin()) with check (true);

-- Trigger for updated_at
drop trigger if exists org_subscriptions_touch on organization_subscriptions;
create trigger org_subscriptions_touch
  before update on organization_subscriptions
  for each row execute function touch_updated_at();

-- ============================================================
-- 10. SEED: System roles
-- ============================================================
insert into roles (name, label, description, is_system, organization_id) values
  ('super_admin', 'Super Admin', 'Acceso global al sistema', true, null),
  ('owner', 'Owner', 'Propietario del restaurante — acceso completo', true, null),
  ('manager', 'Manager', 'Gerente — gestión operativa completa', true, null),
  ('reception', 'Recepción', 'Recepcionista — reservas y mesas', true, null),
  ('staff', 'Personal', 'Personal de sala — operaciones básicas', true, null),
  ('kitchen', 'Cocina', 'Cocina — KDS y pedidos', true, null),
  ('bar', 'Barra', 'Barra — pedidos de barra', true, null),
  ('marketing', 'Marketing', 'Marketing — CRM y campañas', true, null),
  ('accountant', 'Contabilidad', 'Contabilidad — reportes y facturación', true, null)
on conflict (name) do nothing;

-- ============================================================
-- 11. SEED: Permissions
-- ============================================================
insert into permissions (code, label, module, description) values
  -- Reservations
  ('reservations.view', 'Ver reservas', 'reservations', 'Ver listado de reservas'),
  ('reservations.create', 'Crear reservas', 'reservations', 'Crear nuevas reservas'),
  ('reservations.edit', 'Editar reservas', 'reservations', 'Modificar reservas existentes'),
  ('reservations.delete', 'Eliminar reservas', 'reservations', 'Eliminar reservas'),
  ('reservations.transfer', 'Traspasar mesas', 'reservations', 'Mover reservas entre mesas'),
  -- Tables
  ('tables.view', 'Ver mesas', 'tables', 'Ver plano de sala'),
  ('tables.manage', 'Gestionar mesas', 'tables', 'Crear, editar, mover mesas'),
  ('tables.groups', 'Agrupar mesas', 'tables', 'Crear y eliminar grupos de mesas'),
  -- CRM
  ('crm.view', 'Ver clientes', 'crm', 'Ver fichas de clientes'),
  ('crm.manage', 'Gestionar clientes', 'crm', 'Crear, editar, eliminar clientes'),
  ('crm.export', 'Exportar CRM', 'crm', 'Exportar datos de clientes'),
  -- Menu
  ('menu.view', 'Ver carta', 'menu', 'Ver platos y categorías'),
  ('menu.manage', 'Gestionar carta', 'menu', 'Crear, editar, eliminar platos'),
  -- Orders
  ('orders.view', 'Ver pedidos', 'orders', 'Ver pedidos'),
  ('orders.manage', 'Gestionar pedidos', 'orders', 'Crear, modificar, cerrar pedidos'),
  -- Kitchen
  ('kitchen.view', 'Ver cocina', 'kitchen', 'Ver KDS de cocina'),
  ('kitchen.manage', 'Gestionar cocina', 'kitchen', 'Marcar platos como preparados'),
  -- Analytics
  ('analytics.view', 'Ver analíticas', 'analytics', 'Ver métricas y reportes'),
  ('analytics.export', 'Exportar analíticas', 'analytics', 'Exportar reportes'),
  -- Staff
  ('staff.view', 'Ver personal', 'staff', 'Ver turnos y horarios'),
  ('staff.manage', 'Gestionar personal', 'staff', 'Asignar turnos y roles'),
  -- Settings
  ('settings.view', 'Ver ajustes', 'settings', 'Ver configuración del restaurante'),
  ('settings.manage', 'Gestionar ajustes', 'settings', 'Modificar configuración'),
  -- Admin
  ('admin.users', 'Gestionar usuarios', 'admin', 'Invitar y gestionar usuarios'),
  ('admin.billing', 'Gestionar facturación', 'admin', 'Ver y gestionar suscripción'),
  ('admin.audit', 'Ver auditoría', 'admin', 'Ver logs de auditoría')
on conflict (code) do nothing;

-- ============================================================
-- 12. SEED: Role permissions mapping
-- ============================================================
-- Super Admin: all permissions
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p where r.name = 'super_admin'
on conflict do nothing;

-- Owner: all except admin.audit (super admin only)
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.name = 'owner' and p.code != 'admin.audit'
on conflict do nothing;

-- Manager: operational management
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.name = 'manager' and p.code in (
  'reservations.view','reservations.create','reservations.edit','reservations.delete','reservations.transfer',
  'tables.view','tables.manage','tables.groups',
  'crm.view','crm.manage',
  'menu.view','menu.manage',
  'orders.view','orders.manage',
  'kitchen.view','kitchen.manage',
  'analytics.view','analytics.export',
  'staff.view','staff.manage',
  'settings.view','settings.manage',
  'admin.users'
)
on conflict do nothing;

-- Reception: reservations and tables
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.name = 'reception' and p.code in (
  'reservations.view','reservations.create','reservations.edit','reservations.transfer',
  'tables.view','tables.manage',
  'crm.view',
  'orders.view',
  'analytics.view'
)
on conflict do nothing;

-- Staff: basic operations
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.name = 'staff' and p.code in (
  'reservations.view','reservations.create',
  'tables.view',
  'crm.view',
  'orders.view','orders.manage',
  'menu.view'
)
on conflict do nothing;

-- Kitchen: KDS only
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.name = 'kitchen' and p.code in (
  'kitchen.view','kitchen.manage',
  'orders.view'
)
on conflict do nothing;

-- Bar: bar orders
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.name = 'bar' and p.code in (
  'orders.view','orders.manage',
  'menu.view'
)
on conflict do nothing;

-- Marketing: CRM and analytics
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.name = 'marketing' and p.code in (
  'crm.view','crm.manage','crm.export',
  'analytics.view','analytics.export'
)
on conflict do nothing;

-- Accountant: reports and billing
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.name = 'accountant' and p.code in (
  'analytics.view','analytics.export',
  'admin.billing'
)
on conflict do nothing;

-- ============================================================
-- 13. SEED: Subscription plans
-- ============================================================
insert into subscription_plans (name, label, description, price_monthly, price_yearly, max_tables, max_users, max_reservations, features, sort_order) values
  ('starter', 'Starter', 'Para restaurantes pequeños que empiezan', 29.00, 290.00, 15, 3, 500,
    '{"modules":["reservations","tables","crm","menu"],"support":"email"}'::jsonb, 1),
  ('professional', 'Professional', 'Para restaurantes en crecimiento', 59.00, 590.00, 50, 10, null,
    '{"modules":["reservations","tables","crm","menu","analytics","chat","shifts","kitchen"],"support":"priority"}'::jsonb, 2),
  ('enterprise', 'Enterprise', 'Para grupos y cadenas', 149.00, 1490.00, null, null, null,
    '{"modules":["all"],"support":"dedicated","white_label":true,"api_access":true}'::jsonb, 3)
on conflict (name) do nothing;

-- ============================================================
-- 14. Migrate existing users to RBAC
-- ============================================================
-- Assign 'owner' role to existing ADMIN users
insert into user_roles (user_id, role_id, organization_id, assigned_by)
select u.id, r.id, u.organization_id, u.id
from users u, roles r
where u.role = 'ADMIN' and u.organization_id is not null
  and r.name = 'owner'
  and not exists (select 1 from user_roles ur where ur.user_id = u.id and ur.organization_id = u.organization_id)
on conflict do nothing;

-- Assign 'staff' role to existing STAFF users
insert into user_roles (user_id, role_id, organization_id, assigned_by)
select u.id, r.id, u.organization_id, u.id
from users u, roles r
where u.role = 'STAFF' and u.organization_id is not null
  and r.name = 'staff'
  and not exists (select 1 from user_roles ur where ur.user_id = u.id and ur.organization_id = u.organization_id)
on conflict do nothing;

-- Assign 'super_admin' role to super admins
insert into user_roles (user_id, role_id, organization_id, assigned_by)
select u.id, r.id, u.organization_id, u.id
from users u, roles r
where u.is_super_admin = true
  and r.name = 'super_admin'
  and not exists (select 1 from user_roles ur where ur.user_id = u.id)
on conflict do nothing;

-- ============================================================
-- 15. Create user_profiles for existing users
-- ============================================================
insert into user_profiles (user_id, language, timezone)
select id, 'es', 'Europe/Madrid'
from users
where not exists (select 1 from user_profiles p where p.user_id = users.id)
on conflict do nothing;

-- ============================================================
-- 16. Give every organization a trial subscription
-- ============================================================
insert into organization_subscriptions (organization_id, plan_id, billing_cycle, status, trial_ends_at)
select o.id, sp.id, 'monthly', 'trial', now() + interval '30 days'
from organizations o, subscription_plans sp
where sp.name = 'professional'
  and not exists (select 1 from organization_subscriptions os where os.organization_id = o.id)
on conflict do nothing;

comment on table roles is 'RBAC roles. System roles have is_system=true and can''t be deleted. Custom roles can be created per organization.';
comment on table permissions is 'Granular permissions. New permissions can be added without code changes.';
comment on table user_roles is 'Assigns a role to a user within an organization. One role per user per org.';
comment on table user_profiles is 'Extended user data: avatar, language, timezone, preferences.';
comment on table user_sessions is 'Active session tracking. Supports remote session invalidation.';
comment on table user_activity is 'Audit trail of all user actions.';
comment on table subscription_plans is 'Subscription tiers. Architecture ready for Stripe integration (Phase 2).';
comment on table organization_subscriptions is 'Links organizations to subscription plans with billing status.';
