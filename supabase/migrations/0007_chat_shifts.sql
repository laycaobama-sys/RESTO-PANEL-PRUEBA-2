-- ============================================================
-- RestoPanel · Migration 0007 — Chat interno + Turnos del personal
-- ============================================================

-- ============================================================
-- 1. CHAT CHANNELS (canales de comunicación interna)
-- ============================================================
create table if not exists chat_channels (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null,
  icon            text,
  sort_order      int not null default 0,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (organization_id, slug)
);
create index if not exists chat_channels_organization_id_idx on chat_channels(organization_id);

-- ============================================================
-- 2. CHAT MESSAGES (mensajes del chat interno)
-- ============================================================
create table if not exists chat_messages (
  id              uuid primary key default gen_random_uuid(),
  channel_id      uuid not null references chat_channels(id) on delete cascade,
  user_id         uuid references users(id) on delete set null,
  user_name       text not null,
  user_avatar     text,
  content         text not null,
  priority        text not null default 'normal', -- normal | urgent | alert
  read_by         uuid[] not null default '{}',
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at      timestamptz not null default now()
);
create index if not exists chat_messages_channel_id_created_at_idx on chat_messages(channel_id, created_at desc);
create index if not exists chat_messages_organization_id_idx on chat_messages(organization_id);

-- ============================================================
-- 3. STAFF SHIFTS (turnos del personal)
-- ============================================================
create table if not exists staff_shifts (
  id              uuid primary key default gen_random_uuid(),
  staff_name      text not null,
  staff_avatar    text,
  team            text not null default 'SALA', -- SALA | COCINA | BARRA | RECEPCION | EVENTOS
  date            date not null,
  start_time      text not null, -- "10:00"
  end_time        text not null, -- "16:00"
  role            text,
  notes           text,
  status          text not null default 'CONFIRMED', -- CONFIRMED | PENDING | VACATION | ABSENT
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists staff_shifts_organization_id_date_idx on staff_shifts(organization_id, date);
create index if not exists staff_shifts_organization_id_team_idx on staff_shifts(organization_id, team);

-- ============================================================
-- RLS for all new tables
-- ============================================================
alter table chat_channels enable row level security;
drop policy if exists chat_channels_tenant_select on chat_channels;
create policy chat_channels_tenant_select on chat_channels for select using (organization_id = current_user_org_id());
drop policy if exists chat_channels_tenant_insert on chat_channels;
create policy chat_channels_tenant_insert on chat_channels for insert with check (organization_id = current_user_org_id());
drop policy if exists chat_channels_super_admin_select on chat_channels;
create policy chat_channels_super_admin_select on chat_channels for select using (is_current_user_super_admin());

alter table chat_messages enable row level security;
drop policy if exists chat_messages_tenant_select on chat_messages;
create policy chat_messages_tenant_select on chat_messages for select using (organization_id = current_user_org_id());
drop policy if exists chat_messages_tenant_insert on chat_messages;
create policy chat_messages_tenant_insert on chat_messages for insert with check (organization_id = current_user_org_id());
drop policy if exists chat_messages_super_admin_select on chat_messages;
create policy chat_messages_super_admin_select on chat_messages for select using (is_current_user_super_admin());

alter table staff_shifts enable row level security;
drop policy if exists staff_shifts_tenant_select on staff_shifts;
create policy staff_shifts_tenant_select on staff_shifts for select using (organization_id = current_user_org_id());
drop policy if exists staff_shifts_tenant_insert on staff_shifts;
create policy staff_shifts_tenant_insert on staff_shifts for insert with check (organization_id = current_user_org_id());
drop policy if exists staff_shifts_tenant_update on staff_shifts;
create policy staff_shifts_tenant_update on staff_shifts for update using (organization_id = current_user_org_id()) with check (organization_id = current_user_org_id());
drop policy if exists staff_shifts_tenant_delete on staff_shifts;
create policy staff_shifts_tenant_delete on staff_shifts for delete using (organization_id = current_user_org_id());
drop policy if exists staff_shifts_super_admin_select on staff_shifts;
create policy staff_shifts_super_admin_select on staff_shifts for select using (is_current_user_super_admin());
