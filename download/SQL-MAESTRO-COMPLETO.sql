-- ============================================================================
-- RestoPanel · SQL MAESTRO (0001 → 0018 consolidado)
-- ============================================================================
-- Archivo único, autocontenido, idempotente.
-- Pégalo COMPLETO en el SQL Editor de Supabase y pulsa "Run".
-- Puedes ejecutarlo varias veces sin errores.
--
-- Incluye TODAS las migraciones:
--   0001 init · 0002 hardened_rls · 0003 super_admin_audit ·
--   0004 notifications · 0005 notifications_read · 0006 crm_customers ·
--   0007 chat_shifts · 0008 table_groups · 0009 google_reviews ·
--   0010 fix_rls_recursion · 0011 user_blocked · 0012 whatsapp_messages ·
--   0013 import_jobs · 0014 enterprise_rbac · 0015 transfer_rpc ·
--   0016 enterprise_v2 · 0017 billing_enterprise · 0018 audit_fixes
--
-- Reglas aplicadas para idempotencia:
--   - CREATE TABLE IF NOT EXISTS
--   - ALTER TABLE ADD COLUMN IF NOT EXISTS
--   - CREATE INDEX IF NOT EXISTS
--   - DROP POLICY IF EXISTS + CREATE POLICY
--   - DROP FUNCTION IF EXISTS + CREATE FUNCTION (para renombrar params)
--   - DROP TRIGGER IF EXISTS + CREATE TRIGGER
--   - INSERT ... ON CONFLICT DO NOTHING (seeds)
--   - DO $$ IF EXISTS para tablas opcionales
--   - De-duplicación antes de CREATE UNIQUE INDEX
--   - CHECK ... NOT VALID (no valida filas existentes)
-- ============================================================================


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  0. EXTENSIONES                                                      ║
-- ╚════════════════════════════════════════════════════════════════════╝
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  1. FUNCIONES HELPER                                                 ║
-- ║     (DROP IF EXISTS primero para evitar 42P13 al renombrar params)  ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- current_user_org_id()
DROP FUNCTION IF EXISTS current_user_org_id();
CREATE OR REPLACE FUNCTION current_user_org_id()
RETURNS uuid AS $$
DECLARE
  claim text;
BEGIN
  claim := current_setting('request.jwt.claim.user_organization', true);
  RETURN nullif(claim, '')::uuid;
END;
$$ LANGUAGE plpgsql STABLE;
COMMENT ON FUNCTION current_user_org_id() IS
  'Returns the organization_id from the current JWT, or NULL if no JWT is present.';

-- is_current_user_super_admin()
-- Versión sin recursión: lee el claim del JWT (no toca public.users)
DROP FUNCTION IF EXISTS is_current_user_super_admin();
CREATE OR REPLACE FUNCTION is_current_user_super_admin()
RETURNS boolean AS $$
DECLARE
  claim text;
BEGIN
  claim := current_setting('request.jwt.claim.is_super_admin', true);
  RETURN COALESCE(claim, 'false')::boolean;
END;
$$ LANGUAGE plpgsql STABLE;
COMMENT ON FUNCTION is_current_user_super_admin() IS
  'Returns true if the current JWT belongs to a super admin. Reads claim only (no DB query → no recursion).';

-- touch_updated_at()
DROP FUNCTION IF EXISTS touch_updated_at();
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- rls_check()
DROP FUNCTION IF EXISTS rls_check();
CREATE OR REPLACE FUNCTION rls_check()
RETURNS table(tablename text, rls_enabled boolean, policies_count bigint) AS $$
  SELECT t.tablename::text,
         t.rowsecurity,
         COALESCE(p.cnt, 0)
  FROM pg_tables t
  LEFT JOIN (
    SELECT tablename, count(*) AS cnt
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename
  ) p ON p.tablename = t.tablename
  WHERE t.schemaname = 'public'
    AND t.tablename IN (
      'organizations','users','verification_tokens','categories',
      'menu_items','tables','orders','order_items','reservations',
      'organization_settings'
    )
  ORDER BY t.tablename;
$$ LANGUAGE sql STABLE;


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  2. TABLAS CORE (0001_init)                                         ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS organizations (
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
  status              text not null default 'ACTIVE',
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS users (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null unique,
  password_hash       text not null,
  name                text not null,
  phone               text,
  role                text not null default 'ADMIN',
  email_verified      boolean not null default false,
  is_super_admin      boolean not null default false,
  blocked             boolean not null default false,
  blocked_reason      text,
  blocked_at          timestamptz,
  organization_id     uuid references organizations(id) on delete cascade,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS users_organization_id_idx ON users(organization_id);

CREATE TABLE IF NOT EXISTS verification_tokens (
  id              uuid primary key default gen_random_uuid(),
  token           text not null unique,
  type            text not null,
  user_id         uuid not null references users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  expires_at      timestamptz not null,
  used_at         timestamptz,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS verification_tokens_user_id_idx ON verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS verification_tokens_organization_id_idx ON verification_tokens(organization_id);

CREATE TABLE IF NOT EXISTS categories (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null,
  icon            text,
  sort_order      int not null default 0,
  visible         boolean not null default true,
  organization_id uuid not null references organizations(id) on delete cascade,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, slug)
);
CREATE INDEX IF NOT EXISTS categories_organization_id_idx ON categories(organization_id);

CREATE TABLE IF NOT EXISTS menu_items (
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
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS menu_items_organization_id_idx ON menu_items(organization_id);
CREATE INDEX IF NOT EXISTS menu_items_category_id_idx ON menu_items(category_id);

CREATE TABLE IF NOT EXISTS tables (
  id              uuid primary key default gen_random_uuid(),
  number          text not null,
  name             text,
  capacity        int not null default 4,
  zone            text not null default 'INTERIOR',
  shape           text not null default 'SQUARE',
  status          text not null default 'AVAILABLE',
  pos_x           int not null default 0,
  pos_y           int not null default 0,
  group_id        uuid,
  blocked         boolean not null default false,
  blocked_reason  text,
  organization_id uuid not null references organizations(id) on delete cascade,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, number)
);
CREATE INDEX IF NOT EXISTS tables_organization_id_idx ON tables(organization_id);

CREATE TABLE IF NOT EXISTS orders (
  id              uuid primary key default gen_random_uuid(),
  number          int not null,
  status          text not null default 'PENDING',
  order_type      text not null default 'DINE_IN',
  total           numeric(10,2) not null default 0,
  notes           text,
  table_id        uuid references tables(id) on delete set null,
  customer_id     uuid,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS orders_organization_id_idx ON orders(organization_id);
CREATE INDEX IF NOT EXISTS orders_table_id_idx ON orders(table_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  menu_item_id    uuid references menu_items(id) on delete set null,
  quantity        int not null default 1,
  unit_price      numeric(10,2) not null default 0,
  notes           text,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS order_items_organization_id_idx ON order_items(organization_id);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);
CREATE INDEX IF NOT EXISTS order_items_menu_item_id_idx ON order_items(menu_item_id);

CREATE TABLE IF NOT EXISTS reservations (
  id              uuid primary key default gen_random_uuid(),
  customer_name   text not null,
  phone           text,
  email           text,
  party_size      int not null default 2,
  date            timestamptz not null,
  status          text not null default 'PENDING',
  shift           text,
  zone            text,
  source          text not null default 'PHONE',
  notes           text,
  table_id        uuid references tables(id) on delete set null,
  customer_id     uuid,
  organization_id uuid not null references organizations(id) on delete cascade,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS reservations_organization_id_idx ON reservations(organization_id);
CREATE INDEX IF NOT EXISTS reservations_table_id_idx ON reservations(table_id);
CREATE INDEX IF NOT EXISTS reservations_customer_id_idx ON reservations(customer_id);
CREATE INDEX IF NOT EXISTS reservations_status_idx ON reservations(status);
CREATE INDEX IF NOT EXISTS reservations_date_idx ON reservations(date);

CREATE TABLE IF NOT EXISTS organization_settings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  branding        jsonb not null default '{}'::jsonb,
  hours           jsonb not null default '{}'::jsonb,
  modules         jsonb not null default '{}'::jsonb,
  timezone        text not null default 'Europe/Madrid',
  currency        text not null default 'EUR',
  country         text not null default 'España',
  vat_number      text,
  vat_rate        numeric(5,2) not null default 0,
  language        text not null default 'es',
  no_show_policy  jsonb not null default '{}'::jsonb,
  reservation_rules jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Triggers touch_updated_at para tablas core
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'organizations','users','categories','menu_items','tables',
    'orders','reservations','organization_settings'
  ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = t
                 AND column_name = 'updated_at') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I_touch_updated_at ON %I;', t, t);
      EXECUTE format(
        'CREATE TRIGGER %I_touch_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at();',
        t, t
      );
    END IF;
  END LOOP;
END $$;


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  3. RLS POLICIES CORE (0001 + 0002 + 0010 sin recursión)           ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organizations_tenant_all ON organizations;
CREATE POLICY organizations_tenant_all ON organizations
  FOR ALL USING (id = current_user_org_id() OR is_current_user_super_admin())
  WITH CHECK (id = current_user_org_id() OR is_current_user_super_admin());

-- users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_tenant_select ON users;
CREATE POLICY users_tenant_select ON users
  FOR SELECT USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS users_tenant_insert ON users;
CREATE POLICY users_tenant_insert ON users
  FOR INSERT WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS users_tenant_update ON users;
CREATE POLICY users_tenant_update ON users
  FOR UPDATE USING (organization_id = current_user_org_id() OR is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS users_tenant_delete ON users;
CREATE POLICY users_tenant_delete ON users
  FOR DELETE USING (organization_id = current_user_org_id() OR is_current_user_super_admin());

-- categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS categories_tenant_all ON categories;
CREATE POLICY categories_tenant_all ON categories
  FOR ALL USING (organization_id = current_user_org_id() OR is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());

-- menu_items
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS menu_items_tenant_all ON menu_items;
CREATE POLICY menu_items_tenant_all ON menu_items
  FOR ALL USING (organization_id = current_user_org_id() OR is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());

-- tables
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tables_tenant_all ON tables;
CREATE POLICY tables_tenant_all ON tables
  FOR ALL USING (organization_id = current_user_org_id() OR is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());

-- orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS orders_tenant_all ON orders;
CREATE POLICY orders_tenant_all ON orders
  FOR ALL USING (organization_id = current_user_org_id() OR is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());

-- order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_items_tenant_all ON order_items;
CREATE POLICY order_items_tenant_all ON order_items
  FOR ALL USING (organization_id = current_user_org_id() OR is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());

-- reservations
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reservations_tenant_all ON reservations;
CREATE POLICY reservations_tenant_all ON reservations
  FOR ALL USING (organization_id = current_user_org_id() OR is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());

-- organization_settings
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_settings_tenant_all ON organization_settings;
CREATE POLICY organization_settings_tenant_all ON organization_settings
  FOR ALL USING (organization_id = current_user_org_id() OR is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());

-- verification_tokens
ALTER TABLE verification_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS verification_tokens_tenant_all ON verification_tokens;
CREATE POLICY verification_tokens_tenant_all ON verification_tokens
  FOR ALL USING (organization_id = current_user_org_id() OR is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  4. AUDIT LOGS (0003)                                               ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS audit_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete set null,
  organization_id uuid references organizations(id) on delete cascade,
  action          text not null,
  entity_type     text,
  entity_id       text,
  before_data     jsonb,
  after_data      jsonb,
  endpoint        text,
  execution_time_ms int,
  result          text default 'success',
  ip_address      text,
  user_agent      text,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_organization_id_idx ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_tenant_select ON audit_logs;
CREATE POLICY audit_logs_tenant_select ON audit_logs
  FOR SELECT USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS audit_logs_tenant_insert ON audit_logs;
CREATE POLICY audit_logs_tenant_insert ON audit_logs
  FOR INSERT WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS audit_logs_super_admin_all ON audit_logs;
CREATE POLICY audit_logs_super_admin_all ON audit_logs
  FOR ALL USING (is_current_user_super_admin()) WITH CHECK (is_current_user_super_admin());


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  5. NOTIFICATIONS (0004 + 0005)                                     ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid references users(id) on delete cascade,
  type            text not null,
  title           text not null,
  message         text,
  severity        text not null default 'info',
  entity_type     text,
  entity_id       text,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS notifications_organization_id_idx ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_at_idx ON notifications(read_at);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_tenant_select ON notifications;
CREATE POLICY notifications_tenant_select ON notifications
  FOR SELECT USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS notifications_tenant_insert ON notifications;
CREATE POLICY notifications_tenant_insert ON notifications
  FOR INSERT WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS notifications_tenant_update ON notifications;
CREATE POLICY notifications_tenant_update ON notifications
  FOR UPDATE USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS notifications_tenant_delete ON notifications;
CREATE POLICY notifications_tenant_delete ON notifications
  FOR DELETE USING (organization_id = current_user_org_id() OR is_current_user_super_admin());


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  6. CRM: ZONES, CUSTOMERS, TAGS (0006)                              ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS zones (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  color           text not null default '#C5A059',
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS zones_organization_id_idx ON zones(organization_id);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS zones_tenant_select ON zones;
CREATE POLICY zones_tenant_select ON zones
  FOR SELECT USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS zones_tenant_insert ON zones;
CREATE POLICY zones_tenant_insert ON zones
  FOR INSERT WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS zones_tenant_update ON zones;
CREATE POLICY zones_tenant_update ON zones
  FOR UPDATE USING (organization_id = current_user_org_id() OR is_current_user_super_admin());

CREATE TABLE IF NOT EXISTS customers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  email           text,
  phone           text,
  notes           text,
  birthday        date,
  tags            text[] not null default '{}',
  visits_count    int not null default 0,
  last_visit_at   timestamptz,
  organization_id uuid not null references organizations(id) on delete cascade,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS customers_organization_id_idx ON customers(organization_id);

-- De-duplicación antes de UNIQUE (por si hay duplicados en DB existente)
DO $$
DECLARE
  dup_row record;
  survivor_id uuid;
BEGIN
  FOR dup_row IN
    SELECT organization_id, phone
    FROM customers
    WHERE phone IS NOT NULL
    GROUP BY organization_id, phone
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO survivor_id FROM customers
    WHERE organization_id = dup_row.organization_id AND phone = dup_row.phone
    ORDER BY created_at DESC, updated_at DESC LIMIT 1;
    UPDATE reservations SET customer_id = survivor_id
    WHERE customer_id IN (SELECT id FROM customers WHERE organization_id = dup_row.organization_id AND phone = dup_row.phone AND id <> survivor_id);
    DELETE FROM customers WHERE organization_id = dup_row.organization_id AND phone = dup_row.phone AND id <> survivor_id;
  END LOOP;
  FOR dup_row IN
    SELECT organization_id, email
    FROM customers
    WHERE email IS NOT NULL
    GROUP BY organization_id, email
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO survivor_id FROM customers
    WHERE organization_id = dup_row.organization_id AND email = dup_row.email
    ORDER BY created_at DESC, updated_at DESC LIMIT 1;
    UPDATE reservations SET customer_id = survivor_id
    WHERE customer_id IN (SELECT id FROM customers WHERE organization_id = dup_row.organization_id AND email = dup_row.email AND id <> survivor_id);
    DELETE FROM customers WHERE organization_id = dup_row.organization_id AND email = dup_row.email AND id <> survivor_id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS customers_org_phone_uniq
  ON customers(organization_id, phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS customers_org_email_uniq
  ON customers(organization_id, email) WHERE email IS NOT NULL;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customers_tenant_select ON customers;
CREATE POLICY customers_tenant_select ON customers
  FOR SELECT USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS customers_tenant_insert ON customers;
CREATE POLICY customers_tenant_insert ON customers
  FOR INSERT WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS customers_tenant_update ON customers;
CREATE POLICY customers_tenant_update ON customers
  FOR UPDATE USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS customers_tenant_delete ON customers;
CREATE POLICY customers_tenant_delete ON customers
  FOR DELETE USING (organization_id = current_user_org_id() OR is_current_user_super_admin());

-- FK de reservations.customer_id → customers.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reservations_customer_id_fkey'
  ) THEN
    ALTER TABLE reservations
      ADD CONSTRAINT reservations_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- update_customer_metrics() con decremento
DROP FUNCTION IF EXISTS update_customer_metrics() CASCADE;
CREATE OR REPLACE FUNCTION update_customer_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_status text;
  v_new_status text;
  v_customer_id uuid;
BEGIN
  v_old_status := COALESCE(OLD.status, '');
  v_new_status := COALESCE(NEW.status, '');
  IF v_old_status = v_new_status THEN RETURN NEW; END IF;
  v_customer_id := NEW.customer_id;
  IF v_customer_id IS NULL THEN RETURN NEW; END IF;
  IF v_new_status = 'COMPLETED' AND v_old_status != 'COMPLETED' THEN
    UPDATE customers SET visits_count = COALESCE(visits_count, 0) + 1, last_visit_at = now(), updated_at = now()
    WHERE id = v_customer_id;
  END IF;
  IF v_old_status = 'COMPLETED' AND v_new_status != 'COMPLETED' THEN
    UPDATE customers SET visits_count = GREATEST(0, COALESCE(visits_count, 1) - 1), updated_at = now()
    WHERE id = v_customer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reservations_update_customer_metrics ON reservations;
CREATE TRIGGER reservations_update_customer_metrics
  AFTER UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_customer_metrics();

DROP TRIGGER IF EXISTS reservations_insert_customer_metrics ON reservations;
CREATE TRIGGER reservations_insert_customer_metrics
  AFTER INSERT ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_customer_metrics();


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  7. CHAT + SHIFTS (0007)                                            ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS chat_channels (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS chat_channels_organization_id_idx ON chat_channels(organization_id);

ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_channels_tenant_select ON chat_channels;
CREATE POLICY chat_channels_tenant_select ON chat_channels
  FOR SELECT USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS chat_channels_tenant_insert ON chat_channels;
CREATE POLICY chat_channels_tenant_insert ON chat_channels
  FOR INSERT WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS chat_channels_tenant_delete ON chat_channels;
CREATE POLICY chat_channels_tenant_delete ON chat_channels
  FOR DELETE USING (organization_id = current_user_org_id() OR is_current_user_super_admin());

CREATE TABLE IF NOT EXISTS chat_messages (
  id              uuid primary key default gen_random_uuid(),
  channel_id      uuid not null references chat_channels(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  content         text not null,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS chat_messages_channel_id_idx ON chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx ON chat_messages(user_id);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_messages_tenant_select ON chat_messages;
CREATE POLICY chat_messages_tenant_select ON chat_messages
  FOR SELECT USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS chat_messages_tenant_insert ON chat_messages;
CREATE POLICY chat_messages_tenant_insert ON chat_messages
  FOR INSERT WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS chat_messages_tenant_delete ON chat_messages;
CREATE POLICY chat_messages_tenant_delete ON chat_messages
  FOR DELETE USING (organization_id = current_user_org_id() OR is_current_user_super_admin());

CREATE TABLE IF NOT EXISTS staff_shifts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  start_time      timestamptz not null,
  end_time        timestamptz not null,
  role            text,
  notes           text,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS staff_shifts_organization_id_idx ON staff_shifts(organization_id);
CREATE INDEX IF NOT EXISTS staff_shifts_user_id_idx ON staff_shifts(user_id);

ALTER TABLE staff_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_shifts_tenant_select ON staff_shifts;
CREATE POLICY staff_shifts_tenant_select ON staff_shifts
  FOR SELECT USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS staff_shifts_tenant_insert ON staff_shifts;
CREATE POLICY staff_shifts_tenant_insert ON staff_shifts
  FOR INSERT WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS staff_shifts_tenant_update ON staff_shifts;
CREATE POLICY staff_shifts_tenant_update ON staff_shifts
  FOR UPDATE USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS staff_shifts_tenant_delete ON staff_shifts;
CREATE POLICY staff_shifts_tenant_delete ON staff_shifts
  FOR DELETE USING (organization_id = current_user_org_id() OR is_current_user_super_admin());


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  8. TABLE GROUPS (0008) + FK                                        ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS table_groups (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  color           text not null default '#C5A059',
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, name)
);
CREATE INDEX IF NOT EXISTS table_groups_org_idx ON table_groups(organization_id);

ALTER TABLE table_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS table_groups_tenant_select ON table_groups;
CREATE POLICY table_groups_tenant_select ON table_groups
  FOR SELECT USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS table_groups_tenant_insert ON table_groups;
CREATE POLICY table_groups_tenant_insert ON table_groups
  FOR INSERT WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS table_groups_tenant_update ON table_groups;
CREATE POLICY table_groups_tenant_update ON table_groups
  FOR UPDATE USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS table_groups_tenant_delete ON table_groups;
CREATE POLICY table_groups_tenant_delete ON table_groups
  FOR DELETE USING (organization_id = current_user_org_id() OR is_current_user_super_admin());

-- FK de tables.group_id → table_groups.id
UPDATE tables SET group_id = NULL
WHERE group_id IS NOT NULL AND group_id NOT IN (SELECT id FROM table_groups);
ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_group_id_fkey;
ALTER TABLE tables ADD CONSTRAINT tables_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES table_groups(id) ON DELETE SET NULL;


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  9. GOOGLE REVIEWS (0009)                                           ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS google_reviews (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  author_name     text not null,
  author_photo    text,
  rating          int not null,
  text            text,
  language        text,
  time            timestamptz,
  google_review_id text,
  response        text,
  responded_at    timestamptz,
  status          text not null default 'PENDING',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS google_reviews_organization_id_idx ON google_reviews(organization_id);
CREATE INDEX IF NOT EXISTS google_reviews_status_idx ON google_reviews(status);

ALTER TABLE google_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS google_reviews_tenant_select ON google_reviews;
CREATE POLICY google_reviews_tenant_select ON google_reviews
  FOR SELECT USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS google_reviews_tenant_insert ON google_reviews;
CREATE POLICY google_reviews_tenant_insert ON google_reviews
  FOR INSERT WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS google_reviews_tenant_update ON google_reviews;
CREATE POLICY google_reviews_tenant_update ON google_reviews
  FOR UPDATE USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS google_reviews_tenant_delete ON google_reviews;
CREATE POLICY google_reviews_tenant_delete ON google_reviews
  FOR DELETE USING (organization_id = current_user_org_id() OR is_current_user_super_admin());

CREATE TABLE IF NOT EXISTS google_review_settings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references organizations(id) on delete cascade,
  place_id        text,
  place_name      text,
  auto_respond    boolean not null default false,
  auto_respond_template text,
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

ALTER TABLE google_review_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS google_review_settings_tenant_all ON google_review_settings;
CREATE POLICY google_review_settings_tenant_all ON google_review_settings
  FOR ALL USING (organization_id = current_user_org_id() OR is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  10. WHATSAPP MESSAGES (0012)                                       ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id     uuid references customers(id) on delete set null,
  direction       text not null,
  status          text not null default 'queued',
  message_text    text,
  wa_message_id   text,
  template_name   text,
  error           text,
  received_at     timestamptz,
  sent_at         timestamptz,
  delivered_at    timestamptz,
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS whatsapp_messages_organization_id_idx ON whatsapp_messages(organization_id);
CREATE INDEX IF NOT EXISTS whatsapp_messages_customer_id_idx ON whatsapp_messages(customer_id);
CREATE INDEX IF NOT EXISTS whatsapp_messages_status_idx ON whatsapp_messages(status);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS whatsapp_messages_tenant_select ON whatsapp_messages;
CREATE POLICY whatsapp_messages_tenant_select ON whatsapp_messages
  FOR SELECT USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS whatsapp_messages_tenant_insert ON whatsapp_messages;
CREATE POLICY whatsapp_messages_tenant_insert ON whatsapp_messages
  FOR INSERT WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS whatsapp_messages_tenant_update ON whatsapp_messages;
CREATE POLICY whatsapp_messages_tenant_update ON whatsapp_messages
  FOR UPDATE USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS whatsapp_messages_tenant_delete ON whatsapp_messages;
CREATE POLICY whatsapp_messages_tenant_delete ON whatsapp_messages
  FOR DELETE USING (organization_id = current_user_org_id() OR is_current_user_super_admin());


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  11. IMPORT JOBS (0013)                                             ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS import_jobs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  url             text not null,
  status          text not null default 'queued',
  progress        int not null default 0,
  progress_label  text,
  pages_crawled   int not null default 0,
  items_detected  int not null default 0,
  items_imported  int not null default 0,
  result          jsonb,
  error           text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS import_jobs_organization_id_idx ON import_jobs(organization_id);
CREATE INDEX IF NOT EXISTS import_jobs_status_idx ON import_jobs(status);

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS import_jobs_tenant_select ON import_jobs;
CREATE POLICY import_jobs_tenant_select ON import_jobs
  FOR SELECT USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS import_jobs_tenant_insert ON import_jobs;
CREATE POLICY import_jobs_tenant_insert ON import_jobs
  FOR INSERT WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS import_jobs_tenant_update ON import_jobs;
CREATE POLICY import_jobs_tenant_update ON import_jobs
  FOR UPDATE USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS import_jobs_tenant_delete ON import_jobs;
CREATE POLICY import_jobs_tenant_delete ON import_jobs
  FOR DELETE USING (organization_id = current_user_org_id() OR is_current_user_super_admin());

CREATE TABLE IF NOT EXISTS import_html_cache (
  id              uuid primary key default gen_random_uuid(),
  url             text not null unique,
  html            text not null,
  status_code     int,
  fetched_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS import_html_cache_url_idx ON import_html_cache(url);
CREATE INDEX IF NOT EXISTS import_html_cache_expires_at_idx ON import_html_cache(expires_at);


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  12. EMAIL QUEUE (0015)                                             ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS email_queue (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  to_email        text not null,
  subject         text not null,
  html_body       text,
  text_body       text,
  status          text not null default 'pending',
  attempts        int not null default 0,
  last_error      text,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS email_queue_org_idx ON email_queue(organization_id);
CREATE INDEX IF NOT EXISTS email_queue_status_idx ON email_queue(status);

ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_queue_tenant_select ON email_queue;
CREATE POLICY email_queue_tenant_select ON email_queue
  FOR SELECT USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS email_queue_super_admin_all ON email_queue;
CREATE POLICY email_queue_super_admin_all ON email_queue
  FOR ALL USING (is_current_user_super_admin()) WITH CHECK (is_current_user_super_admin());


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  13. ENTERPRISE RBAC (0014)                                         ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS roles (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  label           text not null,
  description     text,
  is_system       boolean not null default false,
  organization_id uuid references organizations(id) on delete cascade,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS roles_organization_id_idx ON roles(organization_id) WHERE organization_id IS NOT NULL;

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roles_tenant_select ON roles;
CREATE POLICY roles_tenant_select ON roles
  FOR SELECT USING (organization_id = current_user_org_id() OR organization_id IS NULL OR is_current_user_super_admin());
DROP POLICY IF EXISTS roles_tenant_insert ON roles;
CREATE POLICY roles_tenant_insert ON roles
  FOR INSERT WITH CHECK (organization_id = current_user_org_id());
DROP POLICY IF EXISTS roles_tenant_update ON roles;
CREATE POLICY roles_tenant_update ON roles
  FOR UPDATE USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS roles_super_admin_all ON roles;
CREATE POLICY roles_super_admin_all ON roles
  FOR ALL USING (is_current_user_super_admin()) WITH CHECK (is_current_user_super_admin());

CREATE TABLE IF NOT EXISTS permissions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  label       text not null,
  module      text not null,
  description text,
  created_at  timestamptz not null default now()
);
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS permissions_select ON permissions;
CREATE POLICY permissions_select ON permissions FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);
CREATE INDEX IF NOT EXISTS role_permissions_permission_id_idx ON role_permissions(permission_id);
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_permissions_select ON role_permissions;
CREATE POLICY role_permissions_select ON role_permissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM roles r WHERE r.id = role_id
      AND (r.organization_id = current_user_org_id() OR r.organization_id IS NULL OR is_current_user_super_admin()))
  );

CREATE TABLE IF NOT EXISTS user_roles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  role_id         uuid not null references roles(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  assigned_by     uuid references users(id) on delete set null,
  assigned_at     timestamptz not null default now(),
  unique (user_id, organization_id)
);
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS user_roles_organization_id_idx ON user_roles(organization_id);
CREATE INDEX IF NOT EXISTS user_roles_role_id_idx ON user_roles(role_id);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_roles_tenant_select ON user_roles;
CREATE POLICY user_roles_tenant_select ON user_roles
  FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS user_roles_tenant_insert ON user_roles;
CREATE POLICY user_roles_tenant_insert ON user_roles
  FOR INSERT WITH CHECK (organization_id = current_user_org_id());
DROP POLICY IF EXISTS user_roles_tenant_update ON user_roles;
CREATE POLICY user_roles_tenant_update ON user_roles
  FOR UPDATE USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS user_roles_tenant_delete ON user_roles;
CREATE POLICY user_roles_tenant_delete ON user_roles
  FOR DELETE USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS user_roles_super_admin_all ON user_roles;
CREATE POLICY user_roles_super_admin_all ON user_roles
  FOR ALL USING (is_current_user_super_admin()) WITH CHECK (is_current_user_super_admin());

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id         uuid primary key references users(id) on delete cascade,
  avatar_url      text,
  language        text not null default 'es',
  timezone        text not null default 'Europe/Madrid',
  preferences     jsonb not null default '{}'::jsonb,
  last_login_at   timestamptz,
  last_login_ip   text,
  last_user_agent text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_profiles_self_select ON user_profiles;
CREATE POLICY user_profiles_self_select ON user_profiles
  FOR SELECT USING (
    user_id::text = current_setting('request.jwt.claim.sub', true)
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = user_id AND u.organization_id = current_user_org_id())
    OR is_current_user_super_admin()
  );
DROP POLICY IF EXISTS user_profiles_self_update ON user_profiles;
CREATE POLICY user_profiles_self_update ON user_profiles
  FOR UPDATE USING (
    user_id::text = current_setting('request.jwt.claim.sub', true)
    OR is_current_user_super_admin()
  );
DROP POLICY IF EXISTS user_profiles_tenant_insert ON user_profiles;
CREATE POLICY user_profiles_tenant_insert ON user_profiles
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = user_id AND u.organization_id = current_user_org_id())
    OR is_current_user_super_admin()
  );
DROP TRIGGER IF EXISTS user_profiles_touch ON user_profiles;
CREATE TRIGGER user_profiles_touch
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE IF NOT EXISTS user_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  token_jti       text not null unique,
  device_info     text,
  ip_address      text,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  last_activity   timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_sessions_token_jti_idx ON user_sessions(token_jti);
CREATE INDEX IF NOT EXISTS user_sessions_active_idx ON user_sessions(user_id) WHERE revoked_at IS NULL;

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_sessions_self_select ON user_sessions;
CREATE POLICY user_sessions_self_select ON user_sessions
  FOR SELECT USING (
    user_id::text = current_setting('request.jwt.claim.sub', true)
    OR is_current_user_super_admin()
  );
DROP POLICY IF EXISTS user_sessions_self_insert ON user_sessions;
CREATE POLICY user_sessions_self_insert ON user_sessions
  FOR INSERT WITH CHECK (
    user_id::text = current_setting('request.jwt.claim.sub', true)
    OR is_current_user_super_admin()
  );
DROP POLICY IF EXISTS user_sessions_self_update ON user_sessions;
CREATE POLICY user_sessions_self_update ON user_sessions
  FOR UPDATE USING (
    user_id::text = current_setting('request.jwt.claim.sub', true)
    OR is_current_user_super_admin()
  );

CREATE TABLE IF NOT EXISTS user_activity (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  action          text not null,
  entity_type     text,
  entity_id       text,
  details         jsonb,
  ip_address      text,
  user_agent      text,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS user_activity_user_id_idx ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS user_activity_organization_id_idx ON user_activity(organization_id);
CREATE INDEX IF NOT EXISTS user_activity_created_at_idx ON user_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS user_activity_action_idx ON user_activity(action);

ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_activity_tenant_select ON user_activity;
CREATE POLICY user_activity_tenant_select ON user_activity
  FOR SELECT USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS user_activity_self_insert ON user_activity;
CREATE POLICY user_activity_self_insert ON user_activity
  FOR INSERT WITH CHECK (true);


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  14. SUBSCRIPTION_PLANS + ORGANIZATION_SUBSCRIPTIONS                ║
-- ║     (combinación de 0014 + 0017 con todas las columnas)             ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS subscription_plans (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null unique,
  label                    text not null default '',
  description              text,
  price_monthly            numeric(10,2) not null default 0,
  price_yearly             numeric(10,2) not null default 0,
  max_tables               int,
  max_users                int,
  max_reservations         int,
  features                 jsonb not null default '{}'::jsonb,
  is_active                boolean not null default true,
  stripe_price_id_monthly text,
  stripe_price_id_yearly  text,
  sort_order               int not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscription_plans_select ON subscription_plans;
CREATE POLICY subscription_plans_select ON subscription_plans FOR SELECT USING (true);
DROP TRIGGER IF EXISTS subscription_plans_touch ON subscription_plans;
CREATE TRIGGER subscription_plans_touch
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references organizations(id) on delete cascade,
  plan_id                   uuid not null references subscription_plans(id),
  billing_cycle             text not null default 'monthly' check (billing_cycle in ('monthly','yearly')),
  status                    text not null default 'trial' check (status in ('trial','active','past_due','canceled','paused')),
  trial_ends_at             timestamptz,
  current_period_start      timestamptz,
  current_period_end        timestamptz,
  stripe_customer_id        text,
  stripe_subscription_id    text,
  cancel_at_period_end      boolean not null default false,
  canceled_at               timestamptz,
  extra_restaurants         int not null default 0,
  extra_restaurant_price    numeric(10,2) not null default 49.00,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (organization_id)
);
ALTER TABLE organization_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean not null default false,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS extra_restaurants int not null default 0,
  ADD COLUMN IF NOT EXISTS extra_restaurant_price numeric(10,2) not null default 49.00;
CREATE INDEX IF NOT EXISTS org_subscriptions_org_idx ON organization_subscriptions(organization_id);

ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_subscriptions_tenant_select ON organization_subscriptions;
CREATE POLICY org_subscriptions_tenant_select ON organization_subscriptions
  FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS org_subscriptions_super_admin_all ON organization_subscriptions;
CREATE POLICY org_subscriptions_super_admin_all ON organization_subscriptions
  FOR ALL USING (is_current_user_super_admin()) WITH CHECK (is_current_user_super_admin());
DROP TRIGGER IF EXISTS org_subscriptions_touch ON organization_subscriptions;
CREATE TRIGGER org_subscriptions_touch
  BEFORE UPDATE ON organization_subscriptions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  15. BILLING TABLES (0017)                                          ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS invoices (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  stripe_invoice_id   text unique,
  number              text,
  amount_paid         numeric(10,2) not null default 0,
  amount_due          numeric(10,2) not null default 0,
  currency            text not null default 'EUR',
  status              text not null default 'open' check (status in ('draft','open','paid','uncollectible','void')),
  billing_reason      text,
  period_start        timestamptz,
  period_end          timestamptz,
  invoice_pdf_url     text,
  hosted_invoice_url  text,
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS invoices_org_idx ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(status);
CREATE INDEX IF NOT EXISTS invoices_created_idx ON invoices(created_at DESC);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoices_tenant_select ON invoices;
CREATE POLICY invoices_tenant_select ON invoices FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS invoices_super_admin_all ON invoices;
CREATE POLICY invoices_super_admin_all ON invoices FOR ALL USING (is_current_user_super_admin()) WITH CHECK (is_current_user_super_admin());

CREATE TABLE IF NOT EXISTS payment_methods (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references organizations(id) on delete cascade,
  stripe_payment_method_id text unique,
  type                     text not null default 'card',
  brand                    text,
  last4                    text,
  exp_month                int,
  exp_year                 int,
  is_default               boolean not null default false,
  created_at               timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS payment_methods_org_idx ON payment_methods(organization_id);
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pm_tenant_select ON payment_methods;
CREATE POLICY pm_tenant_select ON payment_methods FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS pm_super_admin_all ON payment_methods;
CREATE POLICY pm_super_admin_all ON payment_methods FOR ALL USING (is_current_user_super_admin()) WITH CHECK (is_current_user_super_admin());

CREATE TABLE IF NOT EXISTS subscription_history (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_type      text not null,
  from_plan       text,
  to_plan         text,
  from_cycle      text,
  to_cycle        text,
  amount          numeric(10,2),
  currency        text default 'EUR',
  details         jsonb,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS sub_history_org_idx ON subscription_history(organization_id);
CREATE INDEX IF NOT EXISTS sub_history_created_idx ON subscription_history(created_at DESC);
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sh_tenant_select ON subscription_history;
CREATE POLICY sh_tenant_select ON subscription_history FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS sh_super_admin_all ON subscription_history;
CREATE POLICY sh_super_admin_all ON subscription_history FOR ALL USING (is_current_user_super_admin()) WITH CHECK (is_current_user_super_admin());

-- De-duplicación antes de UNIQUE
DELETE FROM subscription_history a
USING subscription_history b
WHERE a.organization_id IS NOT DISTINCT FROM b.organization_id
  AND a.event_type = b.event_type
  AND a.details::text IS NOT DISTINCT FROM b.details::text
  AND a.created_at < b.created_at;
CREATE UNIQUE INDEX IF NOT EXISTS subscription_history_org_event_details_uniq
  ON subscription_history(organization_id, event_type, details);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_stripe_price_monthly_uniq
  ON subscription_plans(stripe_price_id_monthly) WHERE stripe_price_id_monthly IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_stripe_price_yearly_uniq
  ON subscription_plans(stripe_price_id_yearly) WHERE stripe_price_id_yearly IS NOT NULL;

CREATE TABLE IF NOT EXISTS usage_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  metric          text not null,
  value           int not null default 1,
  period          text not null,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS usage_logs_org_period_idx ON usage_logs(organization_id, metric, period);
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ul_tenant_select ON usage_logs;
CREATE POLICY ul_tenant_select ON usage_logs FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS ul_super_admin_all ON usage_logs;
CREATE POLICY ul_super_admin_all ON usage_logs FOR ALL USING (is_current_user_super_admin()) WITH CHECK (is_current_user_super_admin());


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  16. FEATURE FLAGS + ORGANIZATION_USAGE (0015)                      ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS feature_flags (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,
  label         text not null,
  description   text,
  default_value boolean not null default false,
  plan_required text,
  created_at    timestamptz not null default now()
);
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS feature_flags_select ON feature_flags;
CREATE POLICY feature_flags_select ON feature_flags FOR SELECT USING (true);

INSERT INTO feature_flags (key, label, description, default_value, plan_required) VALUES
  ('reservations',        'Reservas',                'Módulo de reservas',                    true,  NULL),
  ('tables',              'Mesas',                   'Plano de sala interactivo',             true,  NULL),
  ('crm',                 'CRM',                     'Gestión de clientes',                   true,  NULL),
  ('menu',                'Carta digital',           'Gestión de carta',                      true,  NULL),
  ('analytics',           'Analíticas',              'Métricas y reportes',                   true,  'professional'),
  ('chat',                'Chat interno',            'Chat entre equipos',                    true,  'professional'),
  ('shifts',              'Turnos',                  'Gestión de turnos del personal',        true,  'professional'),
  ('kitchen',             'Cocina (KDS)',            'Kitchen Display System',                true,  'professional'),
  ('whatsapp',            'WhatsApp Business',       'Mensajería WhatsApp',                    false, 'professional'),
  ('web_import',          'Importación web',         'Importar carta desde web',              true,  'professional'),
  ('google_reviews',      'Gestión de reseñas',      'Panel de Google Reviews',               true,  'professional'),
  ('advanced_analytics',  'Analíticas avanzadas',    'Reportes detallados y exportación',     false, 'enterprise'),
  ('api_access',          'Acceso API',              'API pública para integraciones',        false, 'enterprise'),
  ('white_label',         'Marca blanca',            'Personalización de marca',              false, 'enterprise')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS organization_usage (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  metric          text not null,
  period          text not null,
  count           int not null default 0,
  limit_value     int,
  updated_at      timestamptz not null default now(),
  unique (organization_id, metric, period)
);
CREATE INDEX IF NOT EXISTS org_usage_org_metric_idx ON organization_usage(organization_id, metric);
ALTER TABLE organization_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_usage_tenant_select ON organization_usage;
CREATE POLICY org_usage_tenant_select ON organization_usage FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS org_usage_super_admin_all ON organization_usage;
CREATE POLICY org_usage_super_admin_all ON organization_usage FOR ALL USING (is_current_user_super_admin()) WITH CHECK (is_current_user_super_admin());


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  17. ENTERPRISE V2 (0016)                                           ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- Soft delete columns
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE TABLE IF NOT EXISTS event_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  event_type      text not null,
  entity_type     text,
  entity_id       text,
  payload         jsonb,
  correlation_id  text,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS event_log_org_idx ON event_log(organization_id);
CREATE INDEX IF NOT EXISTS event_log_type_idx ON event_log(event_type);
CREATE INDEX IF NOT EXISTS event_log_correlation_idx ON event_log(correlation_id);
CREATE INDEX IF NOT EXISTS event_log_created_idx ON event_log(created_at DESC);
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_log_tenant_select ON event_log;
CREATE POLICY event_log_tenant_select ON event_log
  FOR SELECT USING (organization_id = current_user_org_id() OR is_current_user_super_admin());
DROP POLICY IF EXISTS event_log_tenant_insert ON event_log;
CREATE POLICY event_log_tenant_insert ON event_log
  FOR INSERT WITH CHECK (true);

CREATE TABLE IF NOT EXISTS feature_flag_overrides (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  flag_key        text not null references feature_flags(key) on delete cascade,
  enabled         boolean not null,
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, flag_key)
);
CREATE INDEX IF NOT EXISTS ffo_org_idx ON feature_flag_overrides(organization_id);
ALTER TABLE feature_flag_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ffo_tenant_select ON feature_flag_overrides;
CREATE POLICY ffo_tenant_select ON feature_flag_overrides
  FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS ffo_tenant_insert ON feature_flag_overrides;
CREATE POLICY ffo_tenant_insert ON feature_flag_overrides
  FOR INSERT WITH CHECK (organization_id = current_user_org_id());
DROP POLICY IF EXISTS ffo_tenant_update ON feature_flag_overrides;
CREATE POLICY ffo_tenant_update ON feature_flag_overrides
  FOR UPDATE USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS ffo_super_admin_all ON feature_flag_overrides;
CREATE POLICY ffo_super_admin_all ON feature_flag_overrides
  FOR ALL USING (is_current_user_super_admin()) WITH CHECK (is_current_user_super_admin());

CREATE TABLE IF NOT EXISTS system_settings (
  key         text primary key,
  value       jsonb not null,
  label       text,
  description text,
  category    text not null default 'general',
  is_secret   boolean not null default false,
  updated_by  uuid references users(id) on delete set null,
  updated_at  timestamptz not null default now()
);
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_settings_super_admin_all ON system_settings;
CREATE POLICY system_settings_super_admin_all ON system_settings
  FOR ALL USING (is_current_user_super_admin()) WITH CHECK (is_current_user_super_admin());
DROP POLICY IF EXISTS system_settings_read ON system_settings;
CREATE POLICY system_settings_read ON system_settings
  FOR SELECT USING (NOT is_secret);

INSERT INTO system_settings (key, value, label, description, category) VALUES
  ('maintenance_mode', 'false'::jsonb, 'Modo Mantenimiento', 'Cuando está activo, solo SuperAdmin puede acceder', 'system'),
  ('maintenance_message', '"Estamos realizando mejoras. Volveremos pronto."'::jsonb, 'Mensaje de Mantenimiento', 'Mensaje que ven los clientes durante el mantenimiento', 'system'),
  ('max_file_upload_mb', '10'::jsonb, 'Tamaño máximo de archivo', 'MB máximo por subida de archivo', 'system'),
  ('reservation_buffer_minutes', '30'::jsonb, 'Buffer entre reservas', 'Minutos mínimos entre reservas en la misma mesa', 'reservations'),
  ('default_reservation_duration', '120'::jsonb, 'Duración de reserva', 'Minutos de duración por defecto', 'reservations'),
  ('auto_confirm_reservations', 'true'::jsonb, 'Auto-confirmar reservas', 'Confirmar reservas automáticamente al crearlas', 'reservations')
ON CONFLICT (key) DO NOTHING;


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  18. TRANSFER_RESERVATION RPC (0015 segura)                         ║
-- ╚════════════════════════════════════════════════════════════════════╝

DROP FUNCTION IF EXISTS transfer_reservation(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS transfer_reservation(uuid, uuid);

CREATE OR REPLACE FUNCTION transfer_reservation(
  p_reservation_id uuid,
  p_new_table_id uuid,
  p_old_table_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reservation record;
  v_new_table record;
  v_org_id uuid;
BEGIN
  v_org_id := current_user_org_id();
  IF v_org_id IS NULL AND NOT is_current_user_super_admin() THEN
    RAISE EXCEPTION 'No organization context';
  END IF;

  SELECT * INTO v_reservation FROM reservations
  WHERE id = p_reservation_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found'; END IF;

  IF v_org_id IS NOT NULL AND v_reservation.organization_id != v_org_id THEN
    RAISE EXCEPTION 'Forbidden: reservation does not belong to your organization';
  END IF;

  IF p_old_table_id IS NOT NULL AND v_reservation.table_id IS NOT NULL
     AND p_old_table_id::text != v_reservation.table_id::text THEN
    RAISE EXCEPTION 'Old table id does not match reservation''s current table';
  END IF;

  SELECT * INTO v_new_table FROM tables
  WHERE id = p_new_table_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Target table not found'; END IF;

  IF v_org_id IS NOT NULL AND v_new_table.organization_id != v_org_id THEN
    RAISE EXCEPTION 'Forbidden: target table does not belong to your organization';
  END IF;

  UPDATE reservations SET table_id = p_new_table_id, updated_at = now()
  WHERE id = p_reservation_id;

  IF v_reservation.table_id IS NOT NULL THEN
    UPDATE tables SET status = 'AVAILABLE', updated_at = now()
    WHERE id = v_reservation.table_id AND organization_id = v_reservation.organization_id;
  END IF;

  UPDATE tables SET status = 'RESERVED', updated_at = now()
  WHERE id = p_new_table_id AND organization_id = v_reservation.organization_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION transfer_reservation IS
  'Atomic transfer of a reservation between tables. Validates org ownership.';


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  19. CHECK CONSTRAINTS (NOT VALID para no romper filas viejas)     ║
-- ╚════════════════════════════════════════════════════════════════════╝

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('SUPER_ADMIN','ADMIN','STAFF')) NOT VALID;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('PENDING','PREPARING','SERVED','COMPLETED','CANCELLED')) NOT VALID;

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('PENDING','CONFIRMED','SEATED','COMPLETED','CANCELLED','NO_SHOW')) NOT VALID;

ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_status_check;
ALTER TABLE tables ADD CONSTRAINT tables_status_check
  CHECK (status IN ('AVAILABLE','OCCUPIED','RESERVED','PREPARING','OUT_OF_SERVICE')) NOT VALID;


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  20. SEED: ROLES + PERMISSIONS + ROLE_PERMISSIONS                   ║
-- ╚════════════════════════════════════════════════════════════════════╝

INSERT INTO roles (name, label, description, is_system, organization_id) VALUES
  ('super_admin', 'Super Admin', 'Acceso global al sistema', true, null),
  ('owner', 'Owner', 'Propietario del restaurante — acceso completo', true, null),
  ('manager', 'Manager', 'Gerente — gestión operativa completa', true, null),
  ('reception', 'Recepción', 'Recepcionista — reservas y mesas', true, null),
  ('staff', 'Personal', 'Personal de sala — operaciones básicas', true, null),
  ('kitchen', 'Cocina', 'Cocina — KDS y pedidos', true, null),
  ('bar', 'Barra', 'Barra — pedidos de barra', true, null),
  ('marketing', 'Marketing', 'Marketing — CRM y campañas', true, null),
  ('accountant', 'Contabilidad', 'Contabilidad — reportes y facturación', true, null)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (code, label, module, description) VALUES
  ('reservations.view', 'Ver reservas', 'reservations', 'Ver listado de reservas'),
  ('reservations.create', 'Crear reservas', 'reservations', 'Crear nuevas reservas'),
  ('reservations.edit', 'Editar reservas', 'reservations', 'Modificar reservas existentes'),
  ('reservations.delete', 'Eliminar reservas', 'reservations', 'Eliminar reservas'),
  ('reservations.transfer', 'Traspasar mesas', 'reservations', 'Mover reservas entre mesas'),
  ('tables.view', 'Ver mesas', 'tables', 'Ver plano de sala'),
  ('tables.manage', 'Gestionar mesas', 'tables', 'Crear, editar, mover mesas'),
  ('tables.groups', 'Agrupar mesas', 'tables', 'Crear y eliminar grupos de mesas'),
  ('crm.view', 'Ver clientes', 'crm', 'Ver fichas de clientes'),
  ('crm.manage', 'Gestionar clientes', 'crm', 'Crear, editar, eliminar clientes'),
  ('crm.export', 'Exportar CRM', 'crm', 'Exportar datos de clientes'),
  ('menu.view', 'Ver carta', 'menu', 'Ver platos y categorías'),
  ('menu.manage', 'Gestionar carta', 'menu', 'Crear, editar, eliminar platos'),
  ('orders.view', 'Ver pedidos', 'orders', 'Ver pedidos'),
  ('orders.manage', 'Gestionar pedidos', 'orders', 'Crear, modificar, cerrar pedidos'),
  ('kitchen.view', 'Ver cocina', 'kitchen', 'Ver KDS de cocina'),
  ('kitchen.manage', 'Gestionar cocina', 'kitchen', 'Marcar platos como preparados'),
  ('analytics.view', 'Ver analíticas', 'analytics', 'Ver métricas y reportes'),
  ('analytics.export', 'Exportar analíticas', 'analytics', 'Exportar reportes'),
  ('staff.view', 'Ver personal', 'staff', 'Ver turnos y horarios'),
  ('staff.manage', 'Gestionar personal', 'staff', 'Asignar turnos y roles'),
  ('settings.view', 'Ver ajustes', 'settings', 'Ver configuración del restaurante'),
  ('settings.manage', 'Gestionar ajustes', 'settings', 'Modificar configuración'),
  ('admin.users', 'Gestionar usuarios', 'admin', 'Invitar y gestionar usuarios'),
  ('admin.billing', 'Gestionar facturación', 'admin', 'Ver y gestionar suscripción'),
  ('admin.audit', 'Ver auditoría', 'admin', 'Ver logs de auditoría')
ON CONFLICT (code) DO NOTHING;

-- super_admin: all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- owner: all except admin.audit
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'owner' AND p.code != 'admin.audit'
ON CONFLICT DO NOTHING;

-- manager: operational management
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'manager' AND p.code IN (
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
) ON CONFLICT DO NOTHING;

-- reception: reservations and tables
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'reception' AND p.code IN (
  'reservations.view','reservations.create','reservations.edit','reservations.transfer',
  'tables.view','tables.manage',
  'crm.view',
  'orders.view',
  'analytics.view'
) ON CONFLICT DO NOTHING;

-- staff: basic operations
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'staff' AND p.code IN (
  'reservations.view','reservations.create',
  'tables.view',
  'crm.view',
  'orders.view','orders.manage',
  'menu.view'
) ON CONFLICT DO NOTHING;

-- kitchen: KDS only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'kitchen' AND p.code IN (
  'kitchen.view','kitchen.manage',
  'orders.view'
) ON CONFLICT DO NOTHING;

-- bar: bar orders
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'bar' AND p.code IN (
  'orders.view','orders.manage',
  'menu.view'
) ON CONFLICT DO NOTHING;

-- marketing: CRM and analytics
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'marketing' AND p.code IN (
  'crm.view','crm.manage','crm.export',
  'analytics.view','analytics.export'
) ON CONFLICT DO NOTHING;

-- accountant: reports and billing
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'accountant' AND p.code IN (
  'analytics.view','analytics.export',
  'admin.billing'
) ON CONFLICT DO NOTHING;


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  21. SEED: SUBSCRIPTION PLANS (precios correctos)                   ║
-- ║     Inicio 59/566 · Premium 119/1142 · Empresarial 249/2390         ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- UPDATE los planes si existen
UPDATE subscription_plans SET
  price_monthly = 59.00, price_yearly = 566.00,
  max_tables = 15, max_users = 3, max_reservations = 500,
  features = '{"modules":["reservations","tables","crm","menu","analytics_basic","google_reviews_read","email_auto"],"support":"standard","max_restaurants":1}'::jsonb,
  label = 'Inicio', description = 'Para restaurantes que empiezan',
  is_active = true, sort_order = 1
WHERE name = 'starter';

UPDATE subscription_plans SET
  price_monthly = 119.00, price_yearly = 1142.00,
  max_tables = 50, max_users = 10, max_reservations = NULL,
  features = '{"modules":["all_basic","tables_premium","table_groups","table_transfer","multi_zone","crm_advanced","campaigns","reputation","ai_responses","whatsapp","shifts","chat","automations"],"support":"priority","max_restaurants":3}'::jsonb,
  label = 'Premium', description = 'Para restaurantes en crecimiento',
  is_active = true, sort_order = 2
WHERE name = 'professional';

UPDATE subscription_plans SET
  price_monthly = 249.00, price_yearly = 2390.00,
  max_tables = NULL, max_users = NULL, max_reservations = NULL,
  features = '{"modules":["all"],"support":"dedicated","max_restaurants":5,"api":true,"webhooks":true,"multi_company":true,"bi":true,"integrations":true,"account_manager":true,"sla":true,"onboarding":true}'::jsonb,
  label = 'Empresarial', description = 'Para grupos y cadenas',
  is_active = true, sort_order = 3
WHERE name = 'enterprise';

-- INSERT si no existen
INSERT INTO subscription_plans (name, label, description, price_monthly, price_yearly, max_tables, max_users, max_reservations, features, is_active, sort_order)
SELECT 'starter', 'Inicio', 'Para restaurantes que empiezan', 59.00, 566.00, 15, 3, 500,
  '{"modules":["reservations","tables","crm","menu","analytics_basic","google_reviews_read","email_auto"],"support":"standard","max_restaurants":1}'::jsonb, true, 1
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'starter');

INSERT INTO subscription_plans (name, label, description, price_monthly, price_yearly, max_tables, max_users, max_reservations, features, is_active, sort_order)
SELECT 'professional', 'Premium', 'Para restaurantes en crecimiento', 119.00, 1142.00, 50, 10, NULL,
  '{"modules":["all_basic","tables_premium","table_groups","table_transfer","multi_zone","crm_advanced","campaigns","reputation","ai_responses","whatsapp","shifts","chat","automations"],"support":"priority","max_restaurants":3}'::jsonb, true, 2
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'professional');

INSERT INTO subscription_plans (name, label, description, price_monthly, price_yearly, max_tables, max_users, max_reservations, features, is_active, sort_order)
SELECT 'enterprise', 'Empresarial', 'Para grupos y cadenas', 249.00, 2390.00, NULL, NULL, NULL,
  '{"modules":["all"],"support":"dedicated","max_restaurants":5,"api":true,"webhooks":true,"multi_company":true,"bi":true,"integrations":true,"account_manager":true,"sla":true,"onboarding":true}'::jsonb, true, 3
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'enterprise');


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  22. SEED: USER PROFILES + TRIAL SUBSCRIPTIONS                      ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- user_profiles para todos los users que no tengan
INSERT INTO user_profiles (user_id, language, timezone)
SELECT id, 'es', 'Europe/Madrid' FROM users
WHERE NOT EXISTS (SELECT 1 FROM user_profiles p WHERE p.user_id = users.id)
ON CONFLICT DO NOTHING;

-- Trial de 30 días para organizaciones que no tengan suscripción
INSERT INTO organization_subscriptions (organization_id, plan_id, billing_cycle, status, trial_ends_at)
SELECT o.id, sp.id, 'monthly', 'trial', now() + interval '30 days'
FROM organizations o, subscription_plans sp
WHERE sp.name = 'professional'
  AND NOT EXISTS (SELECT 1 FROM organization_subscriptions os WHERE os.organization_id = o.id)
ON CONFLICT DO NOTHING;

-- Asignar rol 'owner' a users ADMIN existentes
INSERT INTO user_roles (user_id, role_id, organization_id, assigned_by)
SELECT u.id, r.id, u.organization_id, u.id
FROM users u, roles r
WHERE u.role = 'ADMIN' AND u.organization_id IS NOT NULL
  AND r.name = 'owner'
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.organization_id = u.organization_id)
ON CONFLICT DO NOTHING;

-- Asignar rol 'staff' a users STAFF existentes
INSERT INTO user_roles (user_id, role_id, organization_id, assigned_by)
SELECT u.id, r.id, u.organization_id, u.id
FROM users u, roles r
WHERE u.role = 'STAFF' AND u.organization_id IS NOT NULL
  AND r.name = 'staff'
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.organization_id = u.organization_id)
ON CONFLICT DO NOTHING;

-- Asignar rol 'super_admin' a users is_super_admin
INSERT INTO user_roles (user_id, role_id, organization_id, assigned_by)
SELECT u.id, r.id, u.organization_id, u.id
FROM users u, roles r
WHERE u.is_super_admin = true
  AND r.name = 'super_admin'
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)
ON CONFLICT DO NOTHING;


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  23. TRIGGERS touch_updated_at EN TABLAS RESTANTES                  ║
-- ╚════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'zones','customers','staff_shifts','chat_channels',
    'subscription_plans','feature_flag_overrides','system_settings',
    'email_queue','organization_usage','invoices','table_groups',
    'google_reviews','google_review_settings','whatsapp_messages',
    'import_jobs'
  ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = t
                 AND column_name = 'updated_at') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I;', t, t);
      EXECUTE format(
        'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at();',
        t, t
      );
    END IF;
  END LOOP;
END $$;


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  24. COMMENTS                                                        ║
-- ╚════════════════════════════════════════════════════════════════════╝

COMMENT ON TABLE table_groups IS 'Groups of tables for zone management.';
COMMENT ON FUNCTION transfer_reservation IS 'Atomic transfer of a reservation between tables. Validates org ownership.';
COMMENT ON FUNCTION update_customer_metrics IS 'Updates customer visit counters. Increments on COMPLETED, decrements when reverting.';
COMMENT ON TABLE roles IS 'RBAC roles. System roles cannot be deleted.';
COMMENT ON TABLE permissions IS 'Granular permissions.';
COMMENT ON TABLE user_roles IS 'Assigns a role to a user within an organization.';
COMMENT ON TABLE user_profiles IS 'Extended user data: avatar, language, timezone.';
COMMENT ON TABLE user_sessions IS 'Active session tracking. Supports remote invalidation.';
COMMENT ON TABLE user_activity IS 'Audit trail of all user actions.';
COMMENT ON TABLE subscription_plans IS 'Subscription tiers.';
COMMENT ON TABLE organization_subscriptions IS 'Links organizations to subscription plans.';


-- ============================================================================
-- FIN — Verifica con:
--   SELECT name, label, price_monthly, price_yearly FROM subscription_plans ORDER BY sort_order;
--   SELECT * FROM pg_policies WHERE tablename = 'users' ORDER BY policyname;
--   SELECT * FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE '%uniq%';
--   SELECT * FROM rls_check();
-- ============================================================================
