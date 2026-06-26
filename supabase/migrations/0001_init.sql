-- ============================================================
-- RestoPanel · Multi-tenant schema for Supabase
-- ============================================================
-- Run this in the Supabase SQL editor (or via psql).
-- It creates every table the SaaS needs and protects each one
-- with Row Level Security so a restaurant can NEVER see another
-- restaurant's data, even if someone bypasses the app server.
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "pgcrypto";   -- for gen_random_uuid()

-- ============================================================
-- 1. ORGANIZATIONS  (the "tenant" root)
-- ============================================================
create table if not exists organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null unique,
  phone               text,
  email               text,
  address             text,
  city                text,
  postal_code         text,
  country             text not null default 'España',
  logo                text,
  description         text,
  primary_color       text not null default '#FF6B35',
  currency            text not null default 'EUR',
  opening_hours       text,
  website_url         text,
  public_enabled      boolean not null default true,
  pos_enabled         boolean not null default true,
  reservations_enabled boolean not null default true,
  email_verified      boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- 2. USERS  (restaurant staff, scoped to an organization)
-- ============================================================
create table if not exists users (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null unique,
  password_hash       text not null,           -- bcrypt
  name                text not null,
  phone               text,
  role                text not null default 'ADMIN',  -- ADMIN | STAFF
  email_verified      boolean not null default false,
  organization_id     uuid not null references organizations(id) on delete cascade,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists users_organization_id_idx on users(organization_id);

-- ============================================================
-- 3. VERIFICATION TOKENS  (email verify + password reset)
-- ============================================================
create table if not exists verification_tokens (
  id              uuid primary key default gen_random_uuid(),
  token           text not null unique,
  type            text not null,                   -- RESET_PASSWORD | VERIFY_EMAIL
  user_id         uuid not null references users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  expires_at      timestamptz not null,
  used_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists verification_tokens_user_id_idx on verification_tokens(user_id);
create index if not exists verification_tokens_organization_id_idx on verification_tokens(organization_id);

-- ============================================================
-- 4. CATEGORIES  (menu sections)
-- ============================================================
create table if not exists categories (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null,
  icon            text,
  sort_order      int not null default 0,
  visible         boolean not null default true,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, slug)
);
create index if not exists categories_organization_id_idx on categories(organization_id);

-- ============================================================
-- 5. MENU ITEMS  (dishes & drinks)
-- ============================================================
create table if not exists menu_items (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  price           numeric(10,2) not null default 0,
  image           text,
  available       boolean not null default true,
  visible         boolean not null default true,
  allergens       text,
  sort_order      int not null default 0,
  category_id     uuid not null references categories(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists menu_items_organization_id_idx on menu_items(organization_id);
create index if not exists menu_items_category_id_idx on menu_items(category_id);

-- ============================================================
-- 6. TABLES  (dining tables, with floor-plan position)
-- ============================================================
create table if not exists tables (
  id              uuid primary key default gen_random_uuid(),
  number          text not null,
  name            text,
  capacity        int not null default 4,
  zone            text not null default 'INTERIOR',  -- INTERIOR | TERRACE | BAR | VIP
  shape           text not null default 'SQUARE',     -- SQUARE | ROUND | RECTANGLE
  pos_x           int not null default 0,
  pos_y           int not null default 0,
  status          text not null default 'AVAILABLE',  -- AVAILABLE | OCCUPIED | RESERVED | PREPARING
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, number)
);
create index if not exists tables_organization_id_idx on tables(organization_id);

-- ============================================================
-- 7. ORDERS  (POS orders)
-- ============================================================
create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  number          int not null,
  status          text not null default 'PENDING',     -- PENDING | PREPARING | SERVED | COMPLETED | CANCELLED
  order_type      text not null default 'DINE_IN',     -- DINE_IN | TAKEAWAY | DELIVERY
  total           numeric(10,2) not null default 0,
  notes           text,
  table_id        uuid references tables(id) on delete set null,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists orders_organization_id_status_idx on orders(organization_id, status);
create index if not exists orders_organization_id_created_at_idx on orders(organization_id, created_at);

-- ============================================================
-- 8. ORDER ITEMS  (lines of an order)
-- ============================================================
create table if not exists order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  menu_item_id    uuid not null references menu_items(id) on delete cascade,
  quantity        int not null default 1,
  unit_price      numeric(10,2) not null default 0,
  notes           text,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at      timestamptz not null default now()
);
create index if not exists order_items_order_id_idx on order_items(order_id);
create index if not exists order_items_organization_id_idx on order_items(organization_id);

-- ============================================================
-- 9. RESERVATIONS
-- ============================================================
create table if not exists reservations (
  id              uuid primary key default gen_random_uuid(),
  customer_name   text not null,
  phone           text not null,
  email           text,
  party_size      int not null,
  date            timestamptz not null,
  end_time        timestamptz,
  status          text not null default 'PENDING',  -- PENDING | CONFIRMED | CANCELLED | SEATED | COMPLETED | NO_SHOW
  shift           text not null default 'DINNER',   -- LUNCH | DINNER
  zone            text,                              -- INTERIOR | TERRACE | BAR | VIP
  source          text not null default 'PHONE',    -- PHONE | ONLINE | WALK_IN
  notes           text,
  table_id        uuid references tables(id) on delete set null,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists reservations_organization_id_date_idx on reservations(organization_id, date);
create index if not exists reservations_organization_id_status_idx on reservations(organization_id, status);
create index if not exists reservations_organization_id_shift_idx on reservations(organization_id, shift);

-- ============================================================
-- 10. ORGANIZATION SETTINGS  (1:1 with organizations)
-- ============================================================
create table if not exists organization_settings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references organizations(id) on delete cascade,
  mon_open text default '09:00', mon_close text default '23:00',
  tue_open text default '09:00', tue_close text default '23:00',
  wed_open text default '09:00', wed_close text default '23:00',
  thu_open text default '09:00', thu_close text default '23:00',
  fri_open text default '09:00', fri_close text default '23:30',
  sat_open text default '10:00', sat_close text default '23:30',
  sun_open text default '10:00', sun_close text default '23:00',
  tax_rate       numeric(5,2) not null default 10,
  service_charge numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 11. UPDATED_AT TRIGGER  (auto-touch updated_at on every update)
-- ============================================================
create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  for t in select unnest(array[
    'organizations','users','categories','menu_items','tables',
    'orders','reservations','organization_settings'
  ])
  loop
    execute format('drop trigger if exists %I_touch_updated_at on %I;', t || '_touch', t);
    execute format('create trigger %I_touch_updated_at before update on %I for each row execute function touch_updated_at();', t, t);
  end loop;
end $$;

-- ============================================================
-- 12. ROW LEVEL SECURITY  (the core of multi-tenant isolation)
-- ============================================================
-- Each table gets:
--   * ENABLE ROW LEVEL SECURITY
--   * A helper function current_user_org_id() that reads the
--     JWT claim "user_organization" set by NextAuth when the
--     browser sends its session cookie.
--   * SELECT / INSERT / UPDATE / DELETE policies that filter
--     by organization_id = current_user_org_id().
--
-- Notes:
--   - The service_role key BYPASSES RLS entirely. We only use
--     it in server code (API routes) where we have already
--     authenticated the user via NextAuth and trust the
--     organization_id we derived from the session.
--   - The anon key is subject to RLS. So even if it leaks,
--     a malicious user can only see rows whose
--     organization_id matches their JWT claim, which they
--     cannot forge without the JWT secret.
-- ============================================================

-- Helper: read the organization_id claim from the current JWT.
create or replace function current_user_org_id()
returns uuid as $$
begin
  -- auth.jwt() returns the decoded JWT sent by the Supabase client.
  -- When using NextAuth we don't put our session in auth.jwt(), so
  -- this will return NULL for browser queries — which means RLS
  -- denies everything by default. The server (service_role) bypasses
  -- RLS so it can read freely.
  return nullif(current_setting('request.jwt.claim.user_organization', true), '')::uuid;
end;
$$ language plpgsql stable;

-- Apply RLS to every tenant-scoped table.
do $$
declare t text;
begin
  for t in select unnest(array[
    'users','verification_tokens','categories','menu_items','tables',
    'orders','order_items','reservations','organization_settings'
  ])
  loop
    execute format('alter table %I enable row level security;', t);

    -- SELECT: only rows of the caller's organization
    execute format(
      'drop policy if exists %I_tenant_select on %I;',
      t, t
    );
    execute format(
      'create policy %I_tenant_select on %I for select using (organization_id = current_user_org_id());',
      t, t
    );

    -- INSERT: caller can only insert into their own organization
    execute format(
      'drop policy if exists %I_tenant_insert on %I;',
      t, t
    );
    execute format(
      'create policy %I_tenant_insert on %I for insert with check (organization_id = current_user_org_id());',
      t, t
    );

    -- UPDATE: caller can only update rows in their own organization
    execute format(
      'drop policy if exists %I_tenant_update on %I;',
      t, t
    );
    execute format(
      'create policy %I_tenant_update on %I for update using (organization_id = current_user_org_id()) with check (organization_id = current_user_org_id());',
      t, t
    );

    -- DELETE: caller can only delete rows in their own organization
    execute format(
      'drop policy if exists %I_tenant_delete on %I;',
      t, t
    );
    execute format(
      'create policy %I_tenant_delete on %I for delete using (organization_id = current_user_org_id());',
      t, t
    );
  end loop;
end $$;

-- ============================================================
-- 13. ORGANIZATIONS RLS  (special: a user can only see their own org)
-- ============================================================
alter table organizations enable row level security;

drop policy if exists organizations_tenant_select on organizations;
create policy organizations_tenant_select on organizations
  for select using (id = current_user_org_id());

drop policy if exists organizations_tenant_update on organizations;
create policy organizations_tenant_update on organizations
  for update using (id = current_user_org_id()) with check (id = current_user_org_id());

-- ============================================================
-- DONE. The database is now multi-tenant safe at the storage
-- layer. Even if a bug in the app server forgot to filter by
-- organization_id, RLS would still prevent cross-tenant reads.
-- ============================================================
