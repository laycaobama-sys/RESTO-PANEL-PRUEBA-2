-- ============================================================
-- RestoPanel · Migration 0016 — Enterprise V2
-- ============================================================
-- Soft delete columns, org settings expansion, event log,
-- feature flag overrides, system settings, maintenance mode
-- ============================================================

-- 1. SOFT DELETE — add deleted_at to critical tables
alter table reservations add column if not exists deleted_at timestamptz;
alter table customers add column if not exists deleted_at timestamptz;
alter table users add column if not exists deleted_at timestamptz;
alter table menu_items add column if not exists deleted_at timestamptz;
alter table categories add column if not exists deleted_at timestamptz;
alter table tables add column if not exists deleted_at timestamptz;
alter table organizations add column if not exists deleted_at timestamptz;

-- 2. ORGANIZATION SETTINGS EXPANSION
alter table organization_settings add column if not exists timezone text not null default 'Europe/Madrid';
alter table organization_settings add column if not exists currency text not null default 'EUR';
alter table organization_settings add column if not exists country text not null default 'España';
alter table organization_settings add column if not exists vat_number text;
alter table organization_settings add column if not exists vat_rate numeric(5,2) not null default 0;
alter table organization_settings add column if not exists language text not null default 'es';
alter table organization_settings add column if not exists no_show_policy jsonb not null default '{}'::jsonb;
alter table organization_settings add column if not exists reservation_rules jsonb not null default '{}'::jsonb;

-- 3. EVENT LOG — for event-driven architecture
create table if not exists event_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  event_type      text not null,
  entity_type     text,
  entity_id       text,
  payload         jsonb,
  correlation_id  text,
  created_at      timestamptz not null default now()
);

create index if not exists event_log_org_idx on event_log(organization_id);
create index if not exists event_log_type_idx on event_log(event_type);
create index if not exists event_log_correlation_idx on event_log(correlation_id);
create index if not exists event_log_created_idx on event_log(created_at desc);

alter table event_log enable row level security;
drop policy if exists event_log_tenant_select on event_log;
create policy event_log_tenant_select on event_log
  for select using (organization_id = current_user_org_id() or is_current_user_super_admin());
drop policy if exists event_log_tenant_insert on event_log;
create policy event_log_tenant_insert on event_log
  for insert with check (true);

-- 4. FEATURE FLAG OVERRIDES — per organization
create table if not exists feature_flag_overrides (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  flag_key        text not null references feature_flags(key) on delete cascade,
  enabled         boolean not null,
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, flag_key)
);

create index if not exists ffo_org_idx on feature_flag_overrides(organization_id);

alter table feature_flag_overrides enable row level security;
drop policy if exists ffo_tenant_select on feature_flag_overrides;
create policy ffo_tenant_select on feature_flag_overrides
  for select using (organization_id = current_user_org_id());
drop policy if exists ffo_tenant_insert on feature_flag_overrides;
create policy ffo_tenant_insert on feature_flag_overrides
  for insert with check (organization_id = current_user_org_id());
drop policy if exists ffo_tenant_update on feature_flag_overrides;
create policy ffo_tenant_update on feature_flag_overrides
  for update using (organization_id = current_user_org_id());
drop policy if exists ffo_super_admin_all on feature_flag_overrides;
create policy ffo_super_admin_all on feature_flag_overrides
  for all using (is_current_user_super_admin()) with check (true);

-- 5. SYSTEM SETTINGS — global configuration
create table if not exists system_settings (
  key         text primary key,
  value       jsonb not null,
  label       text,
  description text,
  category    text not null default 'general',
  is_secret   boolean not null default false,
  updated_by  uuid references users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table system_settings enable row level security;
drop policy if exists system_settings_super_admin_all on system_settings;
create policy system_settings_super_admin_all on system_settings
  for all using (is_current_user_super_admin()) with check (true);
drop policy if exists system_settings_read on system_settings;
create policy system_settings_read on system_settings
  for select using (not is_secret);

-- Seed system settings
insert into system_settings (key, value, label, description, category) values
  ('maintenance_mode', 'false'::jsonb, 'Modo Mantenimiento', 'Cuando está activo, solo SuperAdmin puede acceder', 'system'),
  ('maintenance_message', '"Estamos realizando mejoras. Volveremos pronto."'::jsonb, 'Mensaje de Mantenimiento', 'Mensaje que ven los clientes durante el mantenimiento', 'system'),
  ('max_file_upload_mb', '10'::jsonb, 'Tamaño máximo de archivo', 'MB máximo por subida de archivo', 'system'),
  ('reservation_buffer_minutes', '30'::jsonb, 'Buffer entre reservas', 'Minutos mínimos entre reservas en la misma mesa', 'reservations'),
  ('default_reservation_duration', '120'::jsonb, 'Duración de reserva', 'Minutos de duración por defecto', 'reservations'),
  ('auto_confirm_reservations', 'true'::jsonb, 'Auto-confirmar reservas', 'Confirmar reservas automáticamente al crearlas', 'reservations')
on conflict (key) do nothing;

-- 6. AUDIT LOG VERSIONING — add before/after data (already added in 0015 but ensure)
alter table audit_logs add column if not exists before_data jsonb;
alter table audit_logs add column if not exists after_data jsonb;

comment on table event_log is 'Event-driven architecture log. Every significant action generates an event that other modules can react to.';
comment on table feature_flag_overrides is 'Per-organization feature flag overrides. Allows SuperAdmin to enable/disable features per tenant.';
comment on table system_settings is 'Global system configuration. Managed by SuperAdmin. Includes maintenance mode, limits, and defaults.';
