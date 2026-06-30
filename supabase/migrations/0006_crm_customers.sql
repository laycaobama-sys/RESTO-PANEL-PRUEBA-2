-- ============================================================
-- RestoPanel · Migration 0006 — CRM de clientes + zonas + reservas enriquecidas
-- ============================================================
-- Adds a real customer CRM with tags, behavior metrics, and
-- links reservations to customers (instead of just customer_name).
-- Also adds zones table for richer floor-plan management.
-- ============================================================

-- ============================================================
-- 1. ZONES (richer than just a string column on tables)
-- ============================================================
create table if not exists zones (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null,
  color           text not null default '#C5A059',
  icon            text,
  sort_order      int not null default 0,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, slug)
);
create index if not exists zones_organization_id_idx on zones(organization_id);

alter table zones enable row level security;
drop policy if exists zones_tenant_select on zones;
create policy zones_tenant_select on zones for select using (organization_id = current_user_org_id());
drop policy if exists zones_tenant_insert on zones;
create policy zones_tenant_insert on zones for insert with check (organization_id = current_user_org_id());
drop policy if exists zones_tenant_update on zones;
create policy zones_tenant_update on zones for update using (organization_id = current_user_org_id()) with check (organization_id = current_user_org_id());
drop policy if exists zones_tenant_delete on zones;
create policy zones_tenant_delete on zones for delete using (organization_id = current_user_org_id());
drop policy if exists zones_super_admin_select on zones;
create policy zones_super_admin_select on zones for select using (is_current_user_super_admin());
drop policy if exists zones_super_admin_update on zones;
create policy zones_super_admin_update on zones for update using (is_current_user_super_admin());

-- ============================================================
-- 2. CUSTOMERS (CRM)
-- ============================================================
create table if not exists customers (
  id                  uuid primary key default gen_random_uuid(),
  full_name           text not null,
  phone               text not null,
  email               text,
  photo_url           text,
  notes               text,
  preferences         text,
  allergies           text,
  rating              int not null default 0 check (rating >= 0 and rating <= 5),
  vip_status          boolean not null default false,
  -- Aggregated metrics (kept in sync by triggers / app logic)
  total_spend         numeric(10,2) not null default 0,
  average_ticket      numeric(10,2) not null default 0,
  visits_count        int not null default 0,
  cancellations_count int not null default 0,
  no_shows_count      int not null default 0,
  last_visit_at       timestamptz,
  organization_id     uuid not null references organizations(id) on delete cascade,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists customers_organization_id_idx on customers(organization_id);
create index if not exists customers_organization_id_phone_idx on customers(organization_id, phone);
create index if not exists customers_organization_id_email_idx on customers(organization_id, email);
create index if not exists customers_organization_id_vip_idx on customers(organization_id, vip_status) where vip_status = true;

alter table customers enable row level security;
drop policy if exists customers_tenant_select on customers;
create policy customers_tenant_select on customers for select using (organization_id = current_user_org_id());
drop policy if exists customers_tenant_insert on customers;
create policy customers_tenant_insert on customers for insert with check (organization_id = current_user_org_id());
drop policy if exists customers_tenant_update on customers;
create policy customers_tenant_update on customers for update using (organization_id = current_user_org_id()) with check (organization_id = current_user_org_id());
drop policy if exists customers_tenant_delete on customers;
create policy customers_tenant_delete on customers for delete using (organization_id = current_user_org_id());
drop policy if exists customers_super_admin_select on customers;
create policy customers_super_admin_select on customers for select using (is_current_user_super_admin());
drop policy if exists customers_super_admin_update on customers;
create policy customers_super_admin_update on customers for update using (is_current_user_super_admin());

-- ============================================================
-- 3. CUSTOMER TAGS (many-to-many)
-- ============================================================
create table if not exists customer_tags (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  color           text not null default '#C5A059',
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (organization_id, name)
);
create index if not exists customer_tags_organization_id_idx on customer_tags(organization_id);

create table if not exists customer_tag_assignments (
  customer_id     uuid not null references customers(id) on delete cascade,
  tag_id          uuid not null references customer_tags(id) on delete cascade,
  assigned_at     timestamptz not null default now(),
  primary key (customer_id, tag_id)
);
create index if not exists customer_tag_assignments_customer_id_idx on customer_tag_assignments(customer_id);
create index if not exists customer_tag_assignments_tag_id_idx on customer_tag_assignments(tag_id);

alter table customer_tags enable row level security;
drop policy if exists customer_tags_tenant_select on customer_tags;
create policy customer_tags_tenant_select on customer_tags for select using (organization_id = current_user_org_id());
drop policy if exists customer_tags_tenant_insert on customer_tags;
create policy customer_tags_tenant_insert on customer_tags for insert with check (organization_id = current_user_org_id());
drop policy if exists customer_tags_tenant_update on customer_tags;
create policy customer_tags_tenant_update on customer_tags for update using (organization_id = current_user_org_id());
drop policy if exists customer_tags_tenant_delete on customer_tags;
create policy customer_tags_tenant_delete on customer_tags for delete using (organization_id = current_user_org_id());

alter table customer_tag_assignments enable row level security;
-- Tenant can read assignments for customers in their org
drop policy if exists cta_tenant_select on customer_tag_assignments;
create policy cta_tenant_select on customer_tag_assignments for select using (
  exists (select 1 from customers c where c.id = customer_id and c.organization_id = current_user_org_id())
);
drop policy if exists cta_tenant_insert on customer_tag_assignments;
create policy cta_tenant_insert on customer_tag_assignments for insert with check (
  exists (select 1 from customers c where c.id = customer_id and c.organization_id = current_user_org_id())
);
drop policy if exists cta_tenant_delete on customer_tag_assignments;
create policy cta_tenant_delete on customer_tag_assignments for delete using (
  exists (select 1 from customers c where c.id = customer_id and c.organization_id = current_user_org_id())
);

-- ============================================================
-- 4. EXTEND RESERVATIONS with customer_id, end_time, duration
-- ============================================================
alter table reservations add column if not exists customer_id uuid references customers(id) on delete set null;
alter table reservations add column if not exists duration_minutes int not null default 120;
alter table reservations add column if not exists channel text not null default 'PHONE';
alter table reservations add column if not exists actual_arrival timestamptz;
alter table reservations add column if not exists actual_departure timestamptz;

create index if not exists reservations_organization_id_customer_id_idx on reservations(organization_id, customer_id);

-- ============================================================
-- 5. TRIGGER: auto-update customer metrics on reservation status change
-- ============================================================
-- When a reservation moves to COMPLETED, NO_SHOW, or CANCELLED,
-- we update the customer's aggregated counters so the CRM always
-- shows fresh data without expensive queries.
create or replace function update_customer_metrics()
returns trigger as $$
begin
  if new.customer_id is null then
    return new;
  end if;

  -- On COMPLETED: increment visits_count, update last_visit_at,
  -- recompute average_ticket (we don't have spend per reservation yet,
  -- so average_ticket stays as total_spend / visits_count).
  if new.status = 'COMPLETED' and (old.status is null or old.status <> 'COMPLETED') then
    update customers
    set visits_count = visits_count + 1,
        last_visit_at = new.date,
        updated_at = now()
    where id = new.customer_id;
  end if;

  -- On NO_SHOW: increment no_shows_count
  if new.status = 'NO_SHOW' and (old.status is null or old.status <> 'NO_SHOW') then
    update customers
    set no_shows_count = no_shows_count + 1,
        updated_at = now()
    where id = new.customer_id;
  end if;

  -- On CANCELLED: increment cancellations_count
  if new.status = 'CANCELLED' and (old.status is null or old.status <> 'CANCELLED') then
    update customers
    set cancellations_count = cancellations_count + 1,
        updated_at = now()
    where id = new.customer_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists reservations_update_customer_metrics on reservations;
create trigger reservations_update_customer_metrics
  after update on reservations
  for each row execute function update_customer_metrics();

-- Also fire on INSERT if status is already terminal (e.g. seed data)
drop trigger if exists reservations_insert_customer_metrics on reservations;
create trigger reservations_insert_customer_metrics
  after insert on reservations
  for each row execute function update_customer_metrics();

comment on function update_customer_metrics() is
  'Auto-updates customer.visits_count, no_shows_count, cancellations_count and last_visit_at when a reservation changes status. Keeps the CRM metrics fresh without expensive aggregation queries.';
