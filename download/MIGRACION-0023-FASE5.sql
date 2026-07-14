-- ============================================================================
-- RestoPanel · Migración 0023 — Fase 5: Operaciones, KDS, Inventario, TPV, Personal
-- ============================================================================
-- Idempotente. Ejecutar en Supabase SQL Editor.
-- ============================================================================

-- CRÍTICO: pgcrypto necesita estar activa para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Extender orders para TPV completo (solo si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS server_name text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS server_id uuid;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal numeric(10,2) default 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount numeric(10,2) default 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) default 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tip_amount numeric(10,2) default 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status text default 'UNPAID';
    -- Drop constraint first if exists, then add with NOT VALID
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
    ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
      CHECK (payment_status in ('UNPAID','PARTIALLY_PAID','PAID','REFUNDED')) NOT VALID;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number text;
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_invoice_type_check;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_type text;
    ALTER TABLE orders ADD CONSTRAINT orders_invoice_type_check
      CHECK (invoice_type in ('TICKET','SIMPLIFIED','INVOICE')) NOT VALID;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS closed_at timestamptz;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS parent_order_id uuid;
  END IF;
END $$;

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 1: TPV — Pagos, cuentas divididas, propinas                  ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS order_payments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  order_id        uuid not null references orders(id) on delete cascade,
  method          text not null check (method in ('CASH','CARD','BIZUM','APPLE_PAY','GOOGLE_PAY','GIFT_CARD','VOUCHER','INVITATION','MIXED')),
  amount          numeric(10,2) not null,
  tip_amount      numeric(10,2) default 0,
  reference       text,
  status          text not null default 'COMPLETED' check (status in ('PENDING','COMPLETED','FAILED','REFUNDED')),
  processed_at    timestamptz not null default now(),
  refunded_at     timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS order_payments_order_idx ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS order_payments_org_idx ON order_payments(organization_id, processed_at desc);
ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_payments_tenant_all ON order_payments;
CREATE POLICY order_payments_tenant_all ON order_payments
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- Vales / Bonos / Tarjetas regalo
CREATE TABLE IF NOT EXISTS gift_cards (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code            text not null unique,
  initial_balance numeric(10,2) not null,
  current_balance numeric(10,2) not null,
  currency        text not null default 'EUR',
  customer_id     uuid references customers(id) on delete set null,
  expires_at      timestamptz,
  is_active       boolean not null default true,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS gift_cards_org_idx ON gift_cards(organization_id);
CREATE INDEX IF NOT EXISTS gift_cards_code_idx ON gift_cards(code) WHERE is_active = true;
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gift_cards_tenant_all ON gift_cards;
CREATE POLICY gift_cards_tenant_all ON gift_cards
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 2: KDS — Kitchen Display System                               ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS kitchen_stations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  type            text not null check (type in ('GRILL','COLD','DESSERTS','BAR','PIZZA','FRYER','PASTA','GENERAL')),
  color           text not null default '#C5A059',
  sort_order      int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS kitchen_stations_org_idx ON kitchen_stations(organization_id);
ALTER TABLE kitchen_stations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kitchen_stations_tenant_all ON kitchen_stations;
CREATE POLICY kitchen_stations_tenant_all ON kitchen_stations
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- Extender order_items para KDS (solo si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
    ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_kds_status_check;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS kds_status text default 'PENDING';
    ALTER TABLE order_items ADD CONSTRAINT order_items_kds_status_check
      CHECK (kds_status in ('PENDING','ACCEPTED','PREPARING','READY','SERVED','CANCELLED')) NOT VALID;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS kds_station_id uuid;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS kds_accepted_at timestamptz;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS kds_ready_at timestamptz;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS kds_served_at timestamptz;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS kds_priority int default 0;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS kds_notes text;
    CREATE INDEX IF NOT EXISTS order_items_kds_status_idx ON order_items(organization_id, kds_status) WHERE kds_status IN ('PENDING','ACCEPTED','PREPARING','READY');
    CREATE INDEX IF NOT EXISTS order_items_kds_station_idx ON order_items(kds_station_id) WHERE kds_station_id IS NOT NULL;
  END IF;
END $$;

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 3: INVENTARIO                                                ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS inventory_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  category        text,
  barcode         text,
  qr_code         text,
  -- Stock
  stock_current   numeric(10,3) not null default 0,
  stock_min       numeric(10,3) not null default 0,
  stock_ideal     numeric(10,3) not null default 0,
  unit            text not null default 'UNIDAD' check (unit in ('UNIDAD','KG','LITRO','GRAMO','ML','CAJA','PAQUETE')),
  -- Costes
  purchase_price  numeric(10,2) not null default 0,
  sale_price      numeric(10,2) not null default 0,
  tax_rate        numeric(5,2) not null default 10,
  margin_pct      numeric(5,2) generated always as (case when purchase_price > 0 then ((sale_price - purchase_price) / purchase_price * 100) else 0 end) stored,
  -- Lote y caducidad
  lot_number      text,
  expiry_date     date,
  -- Ubicación
  location        text,
  -- Imagen
  image_url       text,
  -- Proveedor
  supplier_id     uuid,
  -- Escandallo
  recipe_id       uuid,
  -- Metadata
  is_active       boolean not null default true,
  last_count_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS inventory_items_org_idx ON inventory_items(organization_id);
CREATE INDEX IF NOT EXISTS inventory_items_barcode_idx ON inventory_items(organization_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_items_low_stock_idx ON inventory_items(organization_id) WHERE stock_current <= stock_min AND is_active = true;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_items_tenant_all ON inventory_items;
CREATE POLICY inventory_items_tenant_all ON inventory_items
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());
DROP TRIGGER IF EXISTS inventory_items_touch ON inventory_items;
CREATE TRIGGER inventory_items_touch BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Movimientos de inventario (entradas/salidas/ajustes)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  item_id         uuid not null references inventory_items(id) on delete cascade,
  type            text not null check (type in ('PURCHASE','SALE','WASTE','ADJUSTMENT','TRANSFER','RETURN','STOCK_COUNT')),
  quantity        numeric(10,3) not null,  -- positivo=entrada, negativo=salida
  unit_cost       numeric(10,2),
  reason          text,
  user_id         uuid references users(id) on delete set null,
  supplier_id     uuid,
  reference       text,   -- número de factura o pedido
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS inventory_movements_item_idx ON inventory_movements(item_id, created_at desc);
CREATE INDEX IF NOT EXISTS inventory_movements_org_idx ON inventory_movements(organization_id, created_at desc);
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_movements_tenant_select ON inventory_movements;
CREATE POLICY inventory_movements_tenant_select ON inventory_movements
  FOR SELECT USING (organization_id = current_user_org_id() or is_current_user_super_admin());
DROP POLICY IF EXISTS inventory_movements_tenant_insert ON inventory_movements;
CREATE POLICY inventory_movements_tenant_insert ON inventory_movements
  FOR INSERT WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 4: ESCANDALLOS (RECETAS)                                     ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS recipes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  menu_item_id    uuid references menu_items(id) on delete set null,
  name            text not null,
  portions        int not null default 1,
  -- Costes calculados
  total_cost      numeric(10,2) not null default 0,
  cost_per_portion numeric(10,2) not null default 0,
  waste_pct       numeric(5,2) not null default 0,  -- merma %
  margin_pct      numeric(5,2) default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS recipes_org_idx ON recipes(organization_id);
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recipes_tenant_all ON recipes;
CREATE POLICY recipes_tenant_all ON recipes
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- Ingredientes de receta (escandallo)
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id              uuid primary key default gen_random_uuid(),
  recipe_id       uuid not null references recipes(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  inventory_item_id uuid references inventory_items(id) on delete set null,
  name            text not null,
  quantity        numeric(10,3) not null,
  unit            text not null default 'KG',
  unit_cost       numeric(10,2) not null default 0,
  total_cost      numeric(10,2) not null default 0,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_idx ON recipe_ingredients(recipe_id);
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recipe_ingredients_tenant_all ON recipe_ingredients;
CREATE POLICY recipe_ingredients_tenant_all ON recipe_ingredients
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 5: PROVEEDORES                                               ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS suppliers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  tax_id          text,
  contact_name    text,
  email           text,
  phone           text,
  address         text,
  city            text,
  postal_code     text,
  country         text default 'España',
  website         text,
  -- Evaluación
  avg_delivery_days numeric(5,1) default 0,
  quality_rating  numeric(3,1) default 0,  -- 0-5
  price_rating    numeric(3,1) default 0,
  -- Estado
  is_active       boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS suppliers_org_idx ON suppliers(organization_id);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS suppliers_tenant_all ON suppliers;
CREATE POLICY suppliers_tenant_all ON suppliers
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());
DROP TRIGGER IF EXISTS suppliers_touch ON suppliers;
CREATE TRIGGER suppliers_touch BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 6+7: COMPRAS + RECEPCIÓN                                     ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS purchase_orders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  supplier_id     uuid not null references suppliers(id) on delete cascade,
  number          text not null,
  status          text not null default 'DRAFT' check (status in ('DRAFT','SENT','PARTIAL','RECEIVED','CANCELLED')),
  -- Totales
  subtotal        numeric(10,2) not null default 0,
  tax_amount      numeric(10,2) not null default 0,
  total           numeric(10,2) not null default 0,
  -- Fechas
  order_date      date not null default current_date,
  expected_date   date,
  received_date   date,
  -- IA
  ai_recommended  boolean not null default false,
  ai_reason       text,
  -- Metadata
  notes           text,
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS purchase_orders_org_idx ON purchase_orders(organization_id, created_at desc);
CREATE INDEX IF NOT EXISTS purchase_orders_supplier_idx ON purchase_orders(supplier_id);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS purchase_orders_tenant_all ON purchase_orders;
CREATE POLICY purchase_orders_tenant_all ON purchase_orders
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());
DROP TRIGGER IF EXISTS purchase_orders_touch ON purchase_orders;
CREATE TRIGGER purchase_orders_touch BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Líneas de pedido de compra
CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id              uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  inventory_item_id uuid references inventory_items(id) on delete set null,
  name            text not null,
  quantity_ordered numeric(10,3) not null,
  quantity_received numeric(10,3) not null default 0,
  unit            text not null default 'UNIDAD',
  unit_cost       numeric(10,2) not null,
  total_cost      numeric(10,2) not null,
  -- Recepción
  lot_number      text,
  expiry_date     date,
  temperature     numeric(5,2),
  -- Incidencias
  has_incidence   boolean not null default false,
  incidence_note  text,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS purchase_order_lines_po_idx ON purchase_order_lines(purchase_order_id);
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS purchase_order_lines_tenant_all ON purchase_order_lines;
CREATE POLICY purchase_order_lines_tenant_all ON purchase_order_lines
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 8: PERSONAL — Extender users                                 ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- BLOQUE 8: PERSONAL — Extender users (solo si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date date;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_cost numeric(10,2) default 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS position text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_personal text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS address text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS tax_id text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS social_security text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_phone text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS notes text;
  END IF;
END $$;

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 9: PLANIFICADOR DE TURNOS                                    ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- staff_shifts ya existe de la migración 0007. La extendemos (solo si existe):
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff_shifts') THEN
    ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS position text;
    ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS break_min int default 30;
    ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS color text;
    ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS is_confirmed boolean default true;
    ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS notes text;
  END IF;
END $$;

-- Vacaciones y ausencias
CREATE TABLE IF NOT EXISTS staff_time_off (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  type            text not null check (type in ('VACATION','SICK_LEAVE','PERSONAL','UNPAID','MATERNITY','PATERNITY','OTHER')),
  start_date      date not null,
  end_date        date not null,
  status          text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  reason          text,
  approved_by     uuid references users(id) on delete set null,
  approved_at     timestamptz,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS staff_time_off_org_idx ON staff_time_off(organization_id);
CREATE INDEX IF NOT EXISTS staff_time_off_user_idx ON staff_time_off(user_id);
ALTER TABLE staff_time_off ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_time_off_tenant_all ON staff_time_off;
CREATE POLICY staff_time_off_tenant_all ON staff_time_off
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 10: CONTROL HORARIO (Fichaje)                                ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS time_clock (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  type            text not null check (type in ('CLOCK_IN','CLOCK_OUT','BREAK_START','BREAK_END')),
  timestamp       timestamptz not null default now(),
  -- Geolocalización
  latitude        numeric(10,7),
  longitude       numeric(10,7),
  -- Dispositivo
  device_info     text,
  ip_address      text,
  -- Firma
  signature_data  text,  -- base64 PNG de la firma
  -- Turno planificado
  shift_id        uuid references staff_shifts(id) on delete set null,
  -- Notas
  notes           text,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS time_clock_user_idx ON time_clock(user_id, timestamp desc);
CREATE INDEX IF NOT EXISTS time_clock_org_idx ON time_clock(organization_id, timestamp desc);
ALTER TABLE time_clock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS time_clock_tenant_all ON time_clock;
CREATE POLICY time_clock_tenant_all ON time_clock
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 13: ADAPTADORES TPV (arquitectura desacoplada)              ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS pos_integrations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider        text not null check (provider in ('SQUARE','LIGHTSPEED','TOAST','MICROS','REVO','AGORA','HOSTELTACTIL','GLOP','TILLER','INTERNAL')),
  name            text not null,
  config          jsonb not null default '{}'::jsonb,  -- credenciales, URLs, etc.
  is_active       boolean not null default true,
  last_sync_at    timestamptz,
  sync_status     text default 'OK' check (sync_status in ('OK','SYNCING','ERROR','DISABLED')),
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS pos_integrations_org_idx ON pos_integrations(organization_id);
ALTER TABLE pos_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos_integrations_tenant_all ON pos_integrations;
CREATE POLICY pos_integrations_tenant_all ON pos_integrations
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 14: IMPORTACIONES                                            ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- Tabla de jobs de importación (ya existe import_jobs de Fase 1, la reutilizamos)
-- Añadimos tipos específicos (solo si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'import_jobs') THEN
    ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS import_type text;
    ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS source_format text;
    ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS total_rows int default 0;
    ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS processed_rows int default 0;
    ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS error_rows int default 0;
    ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS preview_data jsonb;
    ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS rollback_available boolean default false;
  END IF;
END $$;

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 11+12: Vistas analíticas operativas                          ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- Vista de KPIs operativos (solo si todas las tablas necesarias existen)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_items')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suppliers')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_orders') THEN
    CREATE OR REPLACE VIEW operational_kpis_view AS
    SELECT
      o.id as organization_id,
      o.name as organization_name,
      count(distinct u.id) as total_staff,
      count(distinct ii.id) filter (where ii.is_active) as total_inventory_items,
      count(distinct ii.id) filter (where ii.is_active and ii.stock_current <= ii.stock_min) as low_stock_items,
      count(distinct s.id) filter (where s.is_active) as total_suppliers,
      count(distinct po.id) filter (where po.status = 'SENT') as pending_purchase_orders,
      coalesce(sum(po.total) filter (where po.status in ('SENT','PARTIAL','RECEIVED') and po.order_date = current_date), 0) as purchase_today
    FROM organizations o
    LEFT JOIN users u ON u.organization_id = o.id
    LEFT JOIN inventory_items ii ON ii.organization_id = o.id
    LEFT JOIN suppliers s ON s.organization_id = o.id
    LEFT JOIN purchase_orders po ON po.organization_id = o.id
    GROUP BY o.id, o.name;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='operational_kpis_view') THEN
    COMMENT ON VIEW operational_kpis_view IS 'KPIs operativos: personal, inventario, proveedores, compras, KDS.';
  END IF;
END $$;

-- Comments (protegidos — solo si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='order_payments') THEN
    COMMENT ON TABLE order_payments IS 'Pagos de pedidos TPV: efectivo, tarjeta, Bizum, Apple Pay, etc.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='gift_cards') THEN
    COMMENT ON TABLE gift_cards IS 'Vales, bonos y tarjetas regalo con saldo.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='kitchen_stations') THEN
    COMMENT ON TABLE kitchen_stations IS 'Estaciones de cocina para KDS (parrilla, frío, postres, barra, pizzas).';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='inventory_items') THEN
    COMMENT ON TABLE inventory_items IS 'Productos de inventario con stock, costes, lote, caducidad y ubicación.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='inventory_movements') THEN
    COMMENT ON TABLE inventory_movements IS 'Movimientos de inventario: compras, ventas, merma, ajustes.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='recipes') THEN
    COMMENT ON TABLE recipes IS 'Escandallos/recetas con coste calculado y merma.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='recipe_ingredients') THEN
    COMMENT ON TABLE recipe_ingredients IS 'Ingredientes de cada receta con cantidad y coste.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='suppliers') THEN
    COMMENT ON TABLE suppliers IS 'Proveedores con datos fiscales, evaluación y historial.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='purchase_orders') THEN
    COMMENT ON TABLE purchase_orders IS 'Pedidos de compra a proveedores con recepción de mercancía.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='purchase_order_lines') THEN
    COMMENT ON TABLE purchase_order_lines IS 'Líneas de pedido con cantidades recibidas, lotes e incidencias.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='staff_time_off') THEN
    COMMENT ON TABLE staff_time_off IS 'Vacaciones y ausencias del personal.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='time_clock') THEN
    COMMENT ON TABLE time_clock IS 'Control horario: entrada, salida, descansos con geolocalización y firma.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pos_integrations') THEN
    COMMENT ON TABLE pos_integrations IS 'Integraciones con TPV externos (Square, Lightspeed, etc.) mediante adaptadores.';
  END IF;
END $$;

-- ============================================================================
-- FIN
-- ============================================================================
