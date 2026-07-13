-- ============================================================================
-- RestoPanel · Migración 0021 — Fase 3: Motor Reservas + CRM + Fidelización
-- ============================================================================
-- Idempotente. Ejecutar en Supabase SQL Editor.
-- ============================================================================

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 1: MOTOR DE RESERVAS INTELIGENTE                            ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- 1a. Configuración de horarios dinámicos por organización
CREATE TABLE IF NOT EXISTS reservation_schedule (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  day_of_week     int not null check (day_of_week between 0 and 6), -- 0=Dom, 6=Sab
  shift           text not null check (shift in ('LUNCH','DINNER','BREAKFAST','BRUNCH','SNACK','BAR','TERRACE')),
  open_time       time not null,
  close_time      time not null,
  kitchen_close   time,                       -- último pedido a cocina
  bar_close       time,                       -- cierre de barra
  terrace_close   time,                       -- cierre de terraza
  is_active       boolean not null default true,
  -- Capacidad simultánea
  max_capacity    int,                        -- capacidad máxima simultánea (NULL = sin límite)
  max_per_zone    jsonb not null default '{}'::jsonb,   -- {"INTERIOR": 50, "TERRACE": 30}
  max_per_waiter  int,                        -- mesas máximas por camarero
  max_per_kitchen int,                        -- pedidos simultáneos en cocina
  -- Duraciones
  min_duration_min int not null default 60,
  max_duration_min int not null default 180,
  buffer_min       int not null default 15,    -- buffer entre reservas
  cleanup_min      int not null default 10,    -- tiempo de limpieza de mesa
  -- Reglas
  min_party_size   int not null default 1,
  max_party_size   int not null default 20,
  auto_confirm     boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, day_of_week, shift)
);
CREATE INDEX IF NOT EXISTS reservation_schedule_org_idx ON reservation_schedule(organization_id);

-- 1b. Excepciones de horario (festivos, temporada, eventos especiales)
CREATE TABLE IF NOT EXISTS schedule_exceptions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  date            date not null,
  type            text not null check (type in ('HOLIDAY','SEASON','EVENT','CLOSED','SPECIAL')),
  label           text,                       -- "Navidad", "Verano", "San Valentín"
  is_closed       boolean not null default false,
  open_time       time,
  close_time      time,
  max_capacity    int,
  special_rules   jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (organization_id, date)
);
CREATE INDEX IF NOT EXISTS schedule_exceptions_org_date_idx ON schedule_exceptions(organization_id, date);

-- 1c. Tipos de eventos / celebraciones configurables
CREATE TABLE IF NOT EXISTS event_types (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,               -- "Cumpleaños", "Aniversario", "Empresa"
  description     text,
  min_party_size  int not null default 1,
  max_party_size  int not null default 50,
  duration_min    int not null default 120,
  requires_deposit boolean not null default false,
  deposit_amount  numeric(10,2) default 0,
  includes_menu   boolean not null default false,
  menu_id         uuid,                        -- referencia a un menú especial
  special_rules   jsonb not null default '{}'::jsonb,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS event_types_org_idx ON event_types(organization_id);

-- 1d. Extensiones a reservations para motor inteligente
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS duration_minutes int not null default 120;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS event_type_id uuid;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS children_count int not null default 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS high_chair_count int not null default 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS accessibility_needed boolean not null default false;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS preferred_zone text;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS assigned_by text; -- 'manual','ai','reception'
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS ai_score jsonb;   -- puntuación de la asignación IA
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS source_channel text; -- 'web','google','instagram','whatsapp','phone','walk_in'
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS estimated_revenue numeric(10,2);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS deposit_paid numeric(10,2) default 0;

-- 1e. Estado de reserva ampliado (NOT VALID para no romper filas existentes)
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('PENDING','CONFIRMED','SEATED','COMPLETED','CANCELLED','NO_SHOW','WAITLIST','BLOCKED')) NOT VALID;

-- 1f. Lista de espera inteligente
CREATE TABLE IF NOT EXISTS waitlist (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_name   text not null,
  phone           text,
  email           text,
  party_size      int not null default 2,
  children_count  int not null default 0,
  preferred_zone  text,
  preferred_shift text,
  requested_time  timestamptz not null default now(),
  estimated_wait_min int,                     -- calculado por IA
  priority_score  numeric(5,2) not null default 50,   -- 0-100, calculado por IA
  vip_status      boolean not null default false,
  customer_id     uuid references customers(id) on delete set null,
  status          text not null default 'WAITING' check (status in ('WAITING','NOTIFIED','SEATED','CANCELLED','EXPIRED')),
  notified_at     timestamptz,
  seated_at       timestamptz,
  seated_table_id uuid,
  expired_at      timestamptz,
  cancellation_prob numeric(5,2),              -- IA: probabilidad de cancelación 0-1
  notes           text,
  source_channel  text default 'walk_in',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS waitlist_org_status_idx ON waitlist(organization_id, status);
CREATE INDEX IF NOT EXISTS waitlist_priority_idx ON waitlist(organization_id, status, priority_score desc);

-- RLS para waitlist
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS waitlist_tenant_all ON waitlist;
CREATE POLICY waitlist_tenant_all ON waitlist
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());
DROP TRIGGER IF EXISTS waitlist_touch ON waitlist;
CREATE TRIGGER waitlist_touch BEFORE UPDATE ON waitlist
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- RLS para reservation_schedule
ALTER TABLE reservation_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reservation_schedule_tenant_all ON reservation_schedule;
CREATE POLICY reservation_schedule_tenant_all ON reservation_schedule
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- RLS para schedule_exceptions
ALTER TABLE schedule_exceptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS schedule_exceptions_tenant_all ON schedule_exceptions;
CREATE POLICY schedule_exceptions_tenant_all ON schedule_exceptions
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- RLS para event_types
ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_types_tenant_all ON event_types;
CREATE POLICY event_types_tenant_all ON event_types
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- RLS para reservation_schedule / schedule_exceptions / event_types touch triggers
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['reservation_schedule','schedule_exceptions','event_types']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I;', t, t);
    EXECUTE format('CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at();', t, t);
  END LOOP;
END $$;


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 3: CRM ENTERPRISE — Extensiones a customers                 ║
-- ╚════════════════════════════════════════════════════════════════════╝

ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS birthday date;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS anniversary date;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS language text not null default 'es';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_table_id uuid;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_zone text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS allergies text[];
ALTER TABLE customers ADD COLUMN IF NOT EXISTS dietary_restrictions text[];
ALTER TABLE customers ADD COLUMN IF NOT EXISTS favorite_drink text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS favorite_wine text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS internal_notes text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS acquisition_channel text; -- 'web','google','instagram','whatsapp','walk_in','referral'
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_tier text not null default 'BRONZE'
  check (loyalty_tier in ('BRONZE','SILVER','GOLD','PLATINUM','DIAMOND'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_points int not null default 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lifetime_value numeric(10,2) not null default 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avg_ticket numeric(10,2) not null default 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avg_stay_min int not null default 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS prob_return numeric(5,2);   -- 0-1
ALTER TABLE customers ADD COLUMN IF NOT EXISTS prob_cancel numeric(5,2);   -- 0-1
ALTER TABLE customers ADD COLUMN IF NOT EXISTS prob_churn numeric(5,2);    -- 0-1
ALTER TABLE customers ADD COLUMN IF NOT EXISTS segment text;               -- calculado por IA
ALTER TABLE customers ADD COLUMN IF NOT EXISTS risk_score numeric(5,2);    -- 0-100
ALTER TABLE customers ADD COLUMN IF NOT EXISTS vip_status boolean not null default false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS vip_since timestamptz;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags text[] not null default '{}';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_opt_in boolean not null default true;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS next_reservation_at timestamptz;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_reservation_at timestamptz;

-- Índices para queries frecuentes de CRM
CREATE INDEX IF NOT EXISTS customers_loyalty_tier_idx ON customers(organization_id, loyalty_tier);
CREATE INDEX IF NOT EXISTS customers_segment_idx ON customers(organization_id, segment);
CREATE INDEX IF NOT EXISTS customers_birthday_idx ON customers(organization_id, birthday);
CREATE INDEX IF NOT EXISTS customers_vip_idx ON customers(organization_id, vip_status) WHERE vip_status = true;
CREATE INDEX IF NOT EXISTS customers_ltv_idx ON customers(organization_id, lifetime_value desc);
CREATE INDEX IF NOT EXISTS customers_risk_idx ON customers(organization_id, risk_score desc) WHERE risk_score IS NOT NULL;

-- Tabla de notas/historial de interacciones con cliente
CREATE TABLE IF NOT EXISTS customer_interactions (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references customers(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  type            text not null,    -- 'call','email','whatsapp','visit','note','complaint','compliment'
  channel         text,
  subject         text,
  body            text,
  user_id         uuid references users(id) on delete set null,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS customer_interactions_customer_idx ON customer_interactions(customer_id);
CREATE INDEX IF NOT EXISTS customer_interactions_org_idx ON customer_interactions(organization_id, created_at desc);
ALTER TABLE customer_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_interactions_tenant_all ON customer_interactions;
CREATE POLICY customer_interactions_tenant_all ON customer_interactions
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- Tabla de alergias catálogo (por organización)
CREATE TABLE IF NOT EXISTS allergy_catalog (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  name            text not null,
  icon            text,
  is_common       boolean not null default false,
  unique (organization_id, name)
);
INSERT INTO allergy_catalog (name, icon, is_common) VALUES
  ('Gluten','🌾',true), ('Lactosa','🥛',true), ('Frutos secos','🥜',true),
  ('Marisco','🦐',true), ('Huevo','🥚',true), ('Soja','🌱',true),
  ('Pescado','🐟',true), ('Sésamo','🌰',true), ('Mostaza','🌽',true),
  ('Apio','🥬',true), ('Sulfitos','🍷',true), ('Altramuz','🌸',false),
  ('Moluscos','🦪',false)
ON CONFLICT DO NOTHING;


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 5: AUTOMATIZACIONES                                         ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS automations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  trigger_type    text not null,    -- 'reservation.created','reservation.cancelled','customer.birthday','customer.vip','waitlist.seat','no.show.threshold','table.freed','loyalty.tier_up'
  trigger_config  jsonb not null default '{}'::jsonb,
  conditions      jsonb not null default '[]'::jsonb,   -- array de condiciones AND
  actions         jsonb not null default '[]'::jsonb,   -- array de acciones secuenciales
  is_active       boolean not null default true,
  execution_count int not null default 0,
  last_executed_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS automations_org_idx ON automations(organization_id);
CREATE INDEX IF NOT EXISTS automations_trigger_idx ON automations(trigger_type, is_active);

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS automations_tenant_all ON automations;
CREATE POLICY automations_tenant_all ON automations
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());
DROP TRIGGER IF EXISTS automations_touch ON automations;
CREATE TRIGGER automations_touch BEFORE UPDATE ON automations
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Log de ejecuciones de automatizaciones
CREATE TABLE IF NOT EXISTS automation_executions (
  id              uuid primary key default gen_random_uuid(),
  automation_id   uuid not null references automations(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  trigger_data    jsonb not null default '{}'::jsonb,
  actions_executed jsonb not null default '[]'::jsonb,
  status          text not null default 'success' check (status in ('success','partial','failed','skipped')),
  error           text,
  duration_ms     int,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS automation_executions_automation_idx ON automation_executions(automation_id, created_at desc);
CREATE INDEX IF NOT EXISTS automation_executions_org_idx ON automation_executions(organization_id, created_at desc);
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS automation_executions_tenant_select ON automation_executions;
CREATE POLICY automation_executions_tenant_select ON automation_executions
  FOR SELECT USING (organization_id = current_user_org_id() or is_current_user_super_admin());


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 6: FIDELIZACIÓN                                            ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- Configuración de fidelización por organización
CREATE TABLE IF NOT EXISTS loyalty_config (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references organizations(id) on delete cascade,
  -- Puntos
  points_per_visit int not null default 10,
  points_per_euro  numeric(5,2) not null default 1,
  -- Umbrales de niveles
  bronze_threshold  int not null default 0,
  silver_threshold  int not null default 100,
  gold_threshold    int not null default 500,
  platinum_threshold int not null default 1500,
  diamond_threshold int not null default 5000,
  -- Multiplicadores por nivel
  bronze_multiplier  numeric(3,2) not null default 1.0,
  silver_multiplier  numeric(3,2) not null default 1.2,
  gold_multiplier    numeric(3,2) not null default 1.5,
  platinum_multiplier numeric(3,2) not null default 2.0,
  diamond_multiplier numeric(3,2) not null default 3.0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
ALTER TABLE loyalty_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loyalty_config_tenant_all ON loyalty_config;
CREATE POLICY loyalty_config_tenant_all ON loyalty_config
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- Catálogo de recompensas canjeables
CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  type            text not null check (type in ('DISCOUNT','FREE_ITEM','EXPERIENCE','EVENT','UPGRADE','CUSTOM')),
  points_cost     int not null,
  value_eur       numeric(10,2),
  -- Para DISCOUNT: porcentaje o cantidad
  discount_type   text check (discount_type in ('PERCENTAGE','FIXED')),
  discount_value  numeric(10,2),
  -- Para FREE_ITEM: referencia a menu_items
  menu_item_id    uuid,
  -- Para EXPERIENCE/EVENT: descripción
  experience_date timestamptz,
  max_redemptions int,
  redemption_count int not null default 0,
  valid_from      timestamptz,
  valid_until     timestamptz,
  is_active       boolean not null default true,
  image_url       text,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS loyalty_rewards_org_idx ON loyalty_rewards(organization_id, is_active);
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loyalty_rewards_tenant_all ON loyalty_rewards;
CREATE POLICY loyalty_rewards_tenant_all ON loyalty_rewards
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- Historial de transacciones de puntos
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id     uuid not null references customers(id) on delete cascade,
  type            text not null check (type in ('EARN','REDEEM','ADJUST','EXPIRE','BONUS')),
  points          int not null,             -- positivo=gana, negativo=gasta
  balance_after   int not null,
  reason          text,                     -- 'reservation','visit','redeem:reward_id','birthday_bonus','tier_up'
  reservation_id  uuid,
  reward_id       uuid,
  user_id         uuid references users(id) on delete set null,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS loyalty_transactions_customer_idx ON loyalty_transactions(customer_id, created_at desc);
CREATE INDEX IF NOT EXISTS loyalty_transactions_org_idx ON loyalty_transactions(organization_id, created_at desc);
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loyalty_transactions_tenant_select ON loyalty_transactions;
CREATE POLICY loyalty_transactions_tenant_select ON loyalty_transactions
  FOR SELECT USING (organization_id = current_user_org_id() or is_current_user_super_admin());


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 9: IA PREDICTIVA — Snapshot de métricas                    ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS customer_predictions (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references customers(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  -- Probabilidades 0-1
  prob_cancel     numeric(5,2) not null default 0.1,
  prob_no_show    numeric(5,2) not null default 0.05,
  prob_return     numeric(5,2) not null default 0.7,
  prob_upsell     numeric(5,2) not null default 0.3,
  prob_vip        numeric(5,2) not null default 0.1,
  prob_churn      numeric(5,2) not null default 0.2,
  -- Score de riesgo 0-100
  risk_score      numeric(5,2) not null default 20,
  -- Cluster / segmento IA
  cluster         text,                      -- 'vip','frequent','new','dormant','risk','no_show'
  -- LTV predicho
  predicted_ltv   numeric(10,2),
  -- Modelo versión y fecha
  model_version   text not null default 'v1',
  computed_at     timestamptz not null default now(),
  unique (customer_id)
);
CREATE INDEX IF NOT EXISTS customer_predictions_org_idx ON customer_predictions(organization_id);
CREATE INDEX IF NOT EXISTS customer_predictions_cluster_idx ON customer_predictions(organization_id, cluster);
ALTER TABLE customer_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_predictions_tenant_select ON customer_predictions;
CREATE POLICY customer_predictions_tenant_select ON customer_predictions
  FOR SELECT USING (organization_id = current_user_org_id() or is_current_user_super_admin());


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 10: EXPERIENCIA DEL CLIENTE — Upselling                    ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- Catálogo de extras/experiencias vendibles
CREATE TABLE IF NOT EXISTS upsell_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  category        text not null check (category in ('WINE','MENU','TASTING','PARKING','DECORATION','MUSIC','BIRTHDAY','EXPERIENCE','OTHER')),
  price           numeric(10,2) not null default 0,
  image_url       text,
  is_active       boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS upsell_items_org_idx ON upsell_items(organization_id, is_active, sort_order);
ALTER TABLE upsell_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS upsell_items_tenant_all ON upsell_items;
CREATE POLICY upsell_items_tenant_all ON upsell_items
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- Items comprados en una reserva (upselling)
CREATE TABLE IF NOT EXISTS reservation_upsells (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null references reservations(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  upsell_item_id  uuid not null references upsell_items(id) on delete cascade,
  quantity        int not null default 1,
  unit_price      numeric(10,2) not null,
  total_price     numeric(10,2) not null,
  status          text not null default 'PENDING' check (status in ('PENDING','CONFIRMED','DELIVERED','CANCELLED','REFUNDED')),
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS reservation_upsells_reservation_idx ON reservation_upsells(reservation_id);
CREATE INDEX IF NOT EXISTS reservation_upsells_org_idx ON reservation_upsells(organization_id);
ALTER TABLE reservation_upsells ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reservation_upsells_tenant_all ON reservation_upsells;
CREATE POLICY reservation_upsells_tenant_all ON reservation_upsells
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- Timeline de eventos de la reserva (para el cliente)
CREATE TABLE IF NOT EXISTS reservation_timeline (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null references reservations(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  event_type      text not null,    -- 'created','confirmed','reminded','modified','upsell_added','seated','completed','cancelled'
  message         text,
  actor           text,             -- 'system','customer','staff'
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS reservation_timeline_reservation_idx ON reservation_timeline(reservation_id, created_at);
CREATE INDEX IF NOT EXISTS reservation_timeline_org_idx ON reservation_timeline(organization_id, created_at desc);
ALTER TABLE reservation_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reservation_timeline_tenant_all ON reservation_timeline;
CREATE POLICY reservation_timeline_tenant_all ON reservation_timeline
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 8: DASHBOARD EJECUTIVO — Vista materializada                ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- Vista de KPIs diarios por organización
CREATE OR REPLACE VIEW daily_kpis_view AS
SELECT
  o.id as organization_id,
  o.name as organization_name,
  r.date::date as day,
  count(*) filter (where r.status in ('CONFIRMED','SEATED','COMPLETED')) as confirmed_reservations,
  count(*) filter (where r.status = 'COMPLETED') as completed_reservations,
  count(*) filter (where r.status = 'NO_SHOW') as no_shows,
  count(*) filter (where r.status = 'CANCELLED') as cancellations,
  count(*) filter (where r.source_channel = 'web') as from_web,
  count(*) filter (where r.source_channel = 'google') as from_google,
  count(*) filter (where r.source_channel = 'instagram') as from_instagram,
  count(*) filter (where r.source_channel = 'whatsapp') as from_whatsapp,
  count(*) filter (where r.source_channel = 'phone') as from_phone,
  coalesce(sum(r.estimated_revenue) filter (where r.status = 'COMPLETED'), 0) as revenue_realized,
  coalesce(sum(r.estimated_revenue) filter (where r.status in ('CONFIRMED','SEATED')), 0) as revenue_pending,
  coalesce(sum(r.party_size) filter (where r.status = 'COMPLETED'), 0) as covers_served,
  coalesce(avg(extract(epoch from (r.updated_at - r.created_at))/60)
    filter (where r.status = 'COMPLETED'), 0) as avg_stay_min
FROM organizations o
LEFT JOIN reservations r ON r.organization_id = o.id
GROUP BY o.id, o.name, r.date::date;

COMMENT ON VIEW daily_kpis_view IS 'Vista de KPIs diarios por organización para dashboard ejecutivo.';


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  FUNCIONES RPC                                                       ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- 1. RPC: calcular duración variable según party_size
CREATE OR REPLACE FUNCTION calculate_duration(
  p_organization_id uuid,
  p_party_size int,
  p_date date default null
)
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_duration int := 120;
  v_schedule record;
  v_dow int;
BEGIN
  v_dow := extract(dow from coalesce(p_date, current_date));
  SELECT * INTO v_schedule FROM reservation_schedule
  WHERE organization_id = p_organization_id AND day_of_week = v_dow AND is_active = true
  ORDER BY open_time LIMIT 1;

  IF v_schedule IS NOT NULL THEN
    -- Duración base + 15 min por cada persona por encima de 4
    v_duration := v_schedule.min_duration_min;
    IF p_party_size > 4 THEN
      v_duration := v_duration + (p_party_size - 4) * 15;
    END IF;
    v_duration := least(v_duration, v_schedule.max_duration_min);
  END IF;

  RETURN v_duration;
END;
$$;

-- 2. RPC: calcular próxima reserva de un cliente
CREATE OR REPLACE FUNCTION get_customer_next_reservation(p_customer_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT date FROM reservations
  WHERE customer_id = p_customer_id
    AND status IN ('CONFIRMED','PENDING')
    AND date >= now()
  ORDER BY date ASC LIMIT 1;
$$;

-- 3. RPC: recalcular métricas de cliente
CREATE OR REPLACE FUNCTION recalculate_customer_metrics(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id uuid;
  v_visit_count int;
  v_no_show_count int;
  v_cancel_count int;
  v_avg_stay numeric;
  v_ltv numeric;
  v_avg_ticket numeric;
  v_last_visit timestamptz;
  v_next_reservation timestamptz;
BEGIN
  SELECT organization_id INTO v_org_id FROM customers WHERE id = p_customer_id;
  IF v_org_id IS NULL THEN RETURN; END IF;

  SELECT
    count(*) filter (where status = 'COMPLETED'),
    count(*) filter (where status = 'NO_SHOW'),
    count(*) filter (where status = 'CANCELLED')
  INTO v_visit_count, v_no_show_count, v_cancel_count
  FROM reservations WHERE customer_id = p_customer_id;

  SELECT coalesce(avg(extract(epoch from (updated_at - created_at))/60), 0)
  INTO v_avg_stay
  FROM reservations WHERE customer_id = p_customer_id AND status = 'COMPLETED';

  SELECT coalesce(sum(estimated_revenue), 0)
  INTO v_ltv
  FROM reservations WHERE customer_id = p_customer_id AND status = 'COMPLETED';

  v_avg_ticket := case when v_visit_count > 0 then v_ltv / v_visit_count else 0 end;

  SELECT max(date) INTO v_last_visit
  FROM reservations WHERE customer_id = p_customer_id AND status = 'COMPLETED';

  v_next_reservation := get_customer_next_reservation(p_customer_id);

  -- Probabilidad de retorno simple: visits > 0 and last visit < 90 days
  DECLARE
    v_prob_return numeric := 0.5;
    v_prob_cancel numeric := 0.1;
    v_days_since_last int;
  BEGIN
    IF v_last_visit IS NOT NULL THEN
      v_days_since_last := extract(day from now() - v_last_visit);
      IF v_days_since_last < 30 THEN v_prob_return := 0.85;
      ELSIF v_days_since_last < 90 THEN v_prob_return := 0.65;
      ELSIF v_days_since_last < 180 THEN v_prob_return := 0.35;
      ELSE v_prob_return := 0.15;
      END IF;
    END IF;

    IF v_visit_count > 0 THEN
      v_prob_cancel := least(0.9, (v_cancel_count::numeric + v_no_show_count::numeric) / v_visit_count::numeric);
    END IF;

    UPDATE customers SET
      visits_count = coalesce(v_visit_count, 0),
      no_shows_count = coalesce(v_no_show_count, 0),
      cancellations_count = coalesce(v_cancel_count, 0),
      avg_stay_min = coalesce(v_avg_stay, 0),
      lifetime_value = coalesce(v_ltv, 0),
      avg_ticket = coalesce(v_avg_ticket, 0),
      last_visit_at = v_last_visit,
      next_reservation_at = v_next_reservation,
      prob_return = v_prob_return,
      prob_cancel = v_prob_cancel,
      risk_score = (v_prob_cancel * 100)::numeric(5,2),
      updated_at = now()
    WHERE id = p_customer_id;
  END;
END;
$$;

-- 4. RPC: recalcular segmento del cliente
CREATE OR REPLACE FUNCTION recalculate_customer_segment(p_customer_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer record;
  v_segment text;
  v_days_since_last int;
BEGIN
  SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_segment := 'NEW';
  IF v_customer.visits_count IS NULL OR v_customer.visits_count = 0 THEN
    v_segment := 'NEW';
  ELSIF v_customer.vip_status THEN
    v_segment := 'VIP';
  ELSIF v_customer.no_shows_count >= 2 THEN
    v_segment := 'NO_SHOW';
  ELSIF v_customer.cancellations_count >= 3 THEN
    v_segment := 'AT_RISK';
  ELSIF v_customer.last_visit_at IS NOT NULL THEN
    v_days_since_last := extract(day from now() - v_customer.last_visit_at);
    IF v_days_since_last > 180 THEN v_segment := 'DORMANT';
    ELSIF v_days_since_last > 90 THEN v_segment := 'AT_RISK';
    ELSIF v_customer.visits_count >= 10 THEN v_segment := 'FREQUENT';
    ELSIF v_customer.lifetime_value >= 500 THEN v_segment := 'HIGH_VALUE';
    ELSE v_segment := 'REGULAR';
    END IF;
  END IF;

  UPDATE customers SET segment = v_segment, updated_at = now() WHERE id = p_customer_id;
  RETURN v_segment;
END;
$$;

-- 5. Trigger: tras INSERT/UPDATE en reservations, recalcular cliente
CREATE OR REPLACE FUNCTION trigger_recalc_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    PERFORM recalculate_customer_metrics(NEW.customer_id);
    PERFORM recalculate_customer_segment(NEW.customer_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reservations_recalc_customer ON reservations;
CREATE TRIGGER reservations_recalc_customer
  AFTER INSERT OR UPDATE OF status, customer_id, estimated_revenue ON reservations
  FOR EACH ROW EXECUTE FUNCTION trigger_recalc_customer();

-- 6. RPC: IA simple de asignación de mesa (algoritmo de puntuación)
CREATE OR REPLACE FUNCTION suggest_table_for_reservation(
  p_organization_id uuid,
  p_party_size int,
  p_date timestamptz,
  p_duration_min int default 120,
  p_preferred_zone text default null,
  p_customer_id uuid default null,
  p_children_count int default 0,
  p_accessibility_needed boolean default false
)
RETURNS TABLE (
  table_id uuid,
  table_number text,
  table_name text,
  zone text,
  shape text,
  capacity int,
  score numeric,
  reasons text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_slot_start timestamptz := p_date;
  v_slot_end timestamptz := p_date + (p_duration_min || ' minutes')::interval;
  v_customer record;
BEGIN
  -- Cargar preferencias del cliente si se proporciona
  IF p_customer_id IS NOT NULL THEN
    SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.number,
    t.name,
    t.zone,
    t.shape,
    t.capacity,
    -- Score: capacidad óptima = party_size + margen
    (
      -- Capacidad: penalizar mesas demasiado grandes o pequeñas
      case
        when t.capacity < p_party_size then 0
        when t.capacity = p_party_size then 100
        when t.capacity <= p_party_size + 2 then 90
        when t.capacity <= p_party_size + 4 then 70
        else 50
      end
      +
      -- Zona preferida
      case when p_preferred_zone is not null and t.zone = p_preferred_zone then 20 else 0 end
      +
      case when v_customer.preferred_zone is not null and t.zone = v_customer.preferred_zone then 15 else 0 end
      +
      -- Mesa favorita del cliente
      case when v_customer.preferred_table_id is not null and t.id = v_customer.preferred_table_id then 30 else 0 end
      +
      -- Accesibilidad (mesas cuadradas/rectangulares suelen ser mejor)
      case when p_accessibility_needed and t.shape in ('SQUARE','RECTANGLE') then 10 else 0 end
      -
      -- Penalización si está bloqueada
      case when t.blocked then 1000 else 0 end
    )::numeric(5,2) as score,
    ARRAY(
      SELECT reason FROM (VALUES
        (t.capacity = p_party_size, 'Capacidad exacta'),
        (t.capacity > p_party_size and t.capacity <= p_party_size + 2, 'Capacidad óptima'),
        (p_preferred_zone is not null and t.zone = p_preferred_zone, 'Zona preferida'),
        (v_customer.preferred_zone is not null and t.zone = v_customer.preferred_zone, 'Zona favorita del cliente'),
        (v_customer.preferred_table_id is not null and t.id = v_customer.preferred_table_id, 'Mesa favorita del cliente'),
        (t.blocked, 'Bloqueada')
      ) AS v(cond, reason) WHERE cond
    ) as reasons
  FROM tables t
  WHERE t.organization_id = p_organization_id
    AND t.blocked = false
    AND t.status != 'OUT_OF_SERVICE'
    -- No overbooking: excluir mesas con reservas solapadas activas
    AND NOT EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.table_id = t.id
        AND r.organization_id = p_organization_id
        AND r.status IN ('CONFIRMED','PENDING','SEATED')
        AND r.date < v_slot_end
        AND (r.date + (coalesce(r.duration_minutes,120) || ' minutes')::interval) > v_slot_start
    )
    AND t.capacity >= p_party_size
  ORDER BY score DESC, t.capacity ASC
  LIMIT 5;
END;
$$;

COMMENT ON FUNCTION suggest_table_for_reservation IS
  'Algoritmo de IA para asignación de mesas. Puntúa cada mesa disponible según capacidad óptima, zona preferida, mesa favorita del cliente y accesibilidad. Excluye mesas bloqueadas y con overbooking.';

-- 7. RPC: añadir puntos de fidelización tras visita
CREATE OR REPLACE FUNCTION add_loyalty_points(
  p_customer_id uuid,
  p_points int,
  p_reason text,
  p_reservation_id uuid default null,
  p_user_id uuid default null
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id uuid;
  v_balance int;
  v_new_tier text;
  v_old_tier text;
  v_config record;
BEGIN
  SELECT organization_id, loyalty_points, loyalty_tier INTO v_org_id, v_balance, v_old_tier
  FROM customers WHERE id = p_customer_id FOR UPDATE;
  IF v_org_id IS NULL THEN RETURN 0; END IF;

  SELECT * INTO v_config FROM loyalty_config WHERE organization_id = v_org_id AND is_active = true;
  IF v_config IS NULL THEN
    -- Si no hay config, usar defaults
    v_config.row_to_json := null;
  END IF;

  v_balance := v_balance + p_points;

  -- Determinar nuevo tier
  v_new_tier := 'BRONZE';
  IF v_config IS NOT NULL THEN
    IF v_balance >= v_config.diamond_threshold THEN v_new_tier := 'DIAMOND';
    ELSIF v_balance >= v_config.platinum_threshold THEN v_new_tier := 'PLATINUM';
    ELSIF v_balance >= v_config.gold_threshold THEN v_new_tier := 'GOLD';
    ELSIF v_balance >= v_config.silver_threshold THEN v_new_tier := 'SILVER';
    END IF;
  END IF;

  -- Actualizar cliente
  UPDATE customers SET
    loyalty_points = v_balance,
    loyalty_tier = v_new_tier,
    vip_status = (v_new_tier IN ('PLATINUM','DIAMOND')),
    vip_since = case when v_new_tier IN ('PLATINUM','DIAMOND') and vip_status = false then now() else vip_since end,
    updated_at = now()
  WHERE id = p_customer_id;

  -- Insertar transacción
  INSERT INTO loyalty_transactions (
    organization_id, customer_id, type, points, balance_after, reason,
    reservation_id, user_id
  ) VALUES (
    v_org_id, p_customer_id,
    case when p_points >= 0 then 'EARN' else 'REDEEM' end,
    p_points, v_balance, p_reason, p_reservation_id, p_user_id
  );

  -- Si subió de tier, disparar automatización
  IF v_new_tier <> v_old_tier AND
     (CASE v_new_tier WHEN 'BRONZE' THEN 1 WHEN 'SILVER' THEN 2 WHEN 'GOLD' THEN 3 WHEN 'PLATINUM' THEN 4 WHEN 'DIAMOND' THEN 5 END)
     >
     (CASE v_old_tier WHEN 'BRONZE' THEN 1 WHEN 'SILVER' THEN 2 WHEN 'GOLD' THEN 3 WHEN 'PLATINUM' THEN 4 WHEN 'DIAMOND' THEN 5 END)
  THEN
    INSERT INTO notifications (organization_id, type, title, message, severity, metadata)
    VALUES (v_org_id, 'LOYALTY_TIER_UP',
      'Cliente sube de nivel',
      'Cliente ' || p_customer_id || ' subió a ' || v_new_tier,
      'info', jsonb_build_object('customer_id', p_customer_id, 'old_tier', v_old_tier, 'new_tier', v_new_tier));
  END IF;

  RETURN v_balance;
END;
$$;

-- 8. Seed: loyalty_config por defecto para cada organización
INSERT INTO loyalty_config (organization_id)
SELECT o.id FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM loyalty_config lc WHERE lc.organization_id = o.id)
ON CONFLICT DO NOTHING;

-- Comments
COMMENT ON TABLE reservation_schedule IS 'Horarios dinámicos por día/turno con capacidades y reglas variables.';
COMMENT ON TABLE schedule_exceptions IS 'Excepciones de horario: festivos, temporada, eventos especiales.';
COMMENT ON TABLE event_types IS 'Tipos de eventos configurables (cumpleaños, aniversarios, empresa).';
COMMENT ON TABLE waitlist IS 'Lista de espera inteligente con IA de priorización.';
COMMENT ON TABLE automations IS 'Constructor de automatizaciones: trigger → conditions → actions.';
COMMENT ON TABLE loyalty_config IS 'Configuración de fidelización por organización.';
COMMENT ON TABLE loyalty_rewards IS 'Catálogo de recompensas canjeables con puntos.';
COMMENT ON TABLE loyalty_transactions IS 'Historial de transacciones de puntos.';
COMMENT ON TABLE customer_predictions IS 'Predicciones IA por cliente (probabilidades y clusters).';
COMMENT ON TABLE upsell_items IS 'Catálogo de extras vendibles (vino, menús, parking, decoración, etc.).';
COMMENT ON TABLE reservation_upsells IS 'Extras comprados en una reserva.';
COMMENT ON TABLE reservation_timeline IS 'Timeline de eventos de la reserva para el cliente.';

-- ============================================================================
-- FIN
-- ============================================================================
