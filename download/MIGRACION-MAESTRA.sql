-- ============================================================================
-- RestoPanel · MIGRACIÓN MAESTRA (billing + planes + feature flags)
-- ============================================================================
-- Archivo único, autocontenido e idempotente.
-- Pégalo completo en el SQL Editor de Supabase y pulsa "Run".
-- Puedes ejecutarlo varias veces sin errores.
--
-- Soluciona:
--   ✗ ERROR 42P01: relation "organization_subscriptions" does not exist
--   ✗ ERROR 42P01: relation "subscription_plans" does not exist
--   ✗ ERROR 42P01: relation "invoices" does not exist
--   ✗ ERROR 42P01: relation "feature_flags" does not exist
--   ✗ Precios inconsistentes entre DB y frontend
--
-- PRE-REQUISITOS (ya deben existir en tu DB):
--   • Table "organizations" (la crea 0001_init.sql)
--   • Table "users"             (la crea 0001_init.sql)
--   • Function current_user_org_id() (la crea 0001/0002)
--   • Function is_current_user_super_admin() (la crea 0003/0010)
--   • Function touch_updated_at()            (la crea 0001)
--
-- Si alguna de las funciones anteriores no existe, el script las crea
-- con una versión mínima para que no falle nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. FUNCIONES HELPER DE SEGURIDAD
-- ----------------------------------------------------------------------------
-- Las creamos solo si no existen ya (IF NOT EXISTS no aplica a funciones,
-- usamos un bloque DO para protegerlas).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_user_org_id') THEN
    CREATE FUNCTION current_user_org_id() RETURNS uuid AS $fn$
    DECLARE
      claim text;
    BEGIN
      claim := current_setting('request.jwt.claim.user_organization', true);
      RETURN nullif(claim, '')::uuid;
    END;
    $fn$ LANGUAGE plpgsql STABLE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_current_user_super_admin') THEN
    -- Versión sin recursión: lee el claim del JWT en lugar de tocar public.users
    CREATE FUNCTION is_current_user_super_admin() RETURNS boolean AS $fn$
    DECLARE
      claim text;
    BEGIN
      claim := current_setting('request.jwt.claim.is_super_admin', true);
      RETURN COALESCE(claim, 'false')::boolean;
    END;
    $fn$ LANGUAGE plpgsql STABLE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'touch_updated_at') THEN
    CREATE FUNCTION touch_updated_at() RETURNS trigger AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 1. TABLA subscription_plans
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_plans (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL UNIQUE,
  label                    TEXT NOT NULL DEFAULT '',
  description              TEXT,
  price_monthly            NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly             NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_tables               INT,
  max_users                INT,
  max_reservations         INT,
  features                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active                BOOLEAN NOT NULL DEFAULT true,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly  TEXT,
  sort_order               INT NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Garantizar todas las columnas aunque la tabla existiera antes
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT '';
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS price_yearly NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_tables INT;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_users INT;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_reservations INT;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS stripe_price_id_monthly TEXT;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS stripe_price_id_yearly TEXT;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscription_plans_select ON subscription_plans;
CREATE POLICY subscription_plans_select ON subscription_plans
  FOR SELECT USING (true);


-- ----------------------------------------------------------------------------
-- 2. TABLA organization_subscriptions  ← ESTA ES LA QUE FALTABA
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id                   UUID NOT NULL REFERENCES subscription_plans(id),
  billing_cycle             TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly')),
  status                    TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','past_due','canceled','paused')),
  trial_ends_at             TIMESTAMPTZ,
  current_period_start      TIMESTAMPTZ,
  current_period_end        TIMESTAMPTZ,
  stripe_customer_id        TEXT,
  stripe_subscription_id    TEXT,
  cancel_at_period_end      BOOLEAN NOT NULL DEFAULT false,
  canceled_at               TIMESTAMPTZ,
  extra_restaurants         INT NOT NULL DEFAULT 0,
  extra_restaurant_price    NUMERIC(10,2) NOT NULL DEFAULT 49.00,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

-- Asegurar las 4 columnas nuevas de la migración 0017
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS extra_restaurants INT NOT NULL DEFAULT 0;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS extra_restaurant_price NUMERIC(10,2) NOT NULL DEFAULT 49.00;

CREATE INDEX IF NOT EXISTS org_subscriptions_org_idx ON organization_subscriptions(organization_id);

ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_subscriptions_tenant_select ON organization_subscriptions;
CREATE POLICY org_subscriptions_tenant_select ON organization_subscriptions
  FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS org_subscriptions_super_admin_all ON organization_subscriptions;
CREATE POLICY org_subscriptions_super_admin_all ON organization_subscriptions
  FOR ALL USING (is_current_user_super_admin()) WITH CHECK (true);

DROP TRIGGER IF EXISTS org_subscriptions_touch ON organization_subscriptions;
CREATE TRIGGER org_subscriptions_touch
  BEFORE UPDATE ON organization_subscriptions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ----------------------------------------------------------------------------
-- 3. TABLAS DE BILLING (invoices, payment_methods, subscription_history, usage_logs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_invoice_id   TEXT UNIQUE,
  number              TEXT,
  amount_paid         NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_due          NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'EUR',
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','paid','uncollectible','void')),
  billing_reason      TEXT,
  period_start        TIMESTAMPTZ,
  period_end          TIMESTAMPTZ,
  invoice_pdf_url     TEXT,
  hosted_invoice_url  TEXT,
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_org_idx ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(status);
CREATE INDEX IF NOT EXISTS invoices_created_idx ON invoices(created_at DESC);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoices_tenant_select ON invoices;
CREATE POLICY invoices_tenant_select ON invoices FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS invoices_super_admin_all ON invoices;
CREATE POLICY invoices_super_admin_all ON invoices FOR ALL USING (is_current_user_super_admin()) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS payment_methods (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT UNIQUE,
  type                     TEXT NOT NULL DEFAULT 'card',
  brand                    TEXT,
  last4                    TEXT,
  exp_month                INT,
  exp_year                 INT,
  is_default               BOOLEAN NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_methods_org_idx ON payment_methods(organization_id);
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pm_tenant_select ON payment_methods;
CREATE POLICY pm_tenant_select ON payment_methods FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS pm_super_admin_all ON payment_methods;
CREATE POLICY pm_super_admin_all ON payment_methods FOR ALL USING (is_current_user_super_admin()) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS subscription_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  from_plan       TEXT,
  to_plan         TEXT,
  from_cycle      TEXT,
  to_cycle        TEXT,
  amount          NUMERIC(10,2),
  currency        TEXT DEFAULT 'EUR',
  details         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sub_history_org_idx ON subscription_history(organization_id);
CREATE INDEX IF NOT EXISTS sub_history_created_idx ON subscription_history(created_at DESC);
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sh_tenant_select ON subscription_history;
CREATE POLICY sh_tenant_select ON subscription_history FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS sh_super_admin_all ON subscription_history;
CREATE POLICY sh_super_admin_all ON subscription_history FOR ALL USING (is_current_user_super_admin()) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS usage_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric          TEXT NOT NULL,
  value           INT NOT NULL DEFAULT 1,
  period          TEXT NOT NULL,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usage_logs_org_period_idx ON usage_logs(organization_id, metric, period);
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ul_tenant_select ON usage_logs;
CREATE POLICY ul_tenant_select ON usage_logs FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS ul_super_admin_all ON usage_logs;
CREATE POLICY ul_super_admin_all ON usage_logs FOR ALL USING (is_current_user_super_admin()) WITH CHECK (true);


-- ----------------------------------------------------------------------------
-- 4. FEATURE FLAGS + ORGANIZATION_USAGE
-- (las usa src/lib/feature-flags.ts — si no existen, esa librería falla silenciosamente)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feature_flags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE,
  label         TEXT NOT NULL,
  description   TEXT,
  default_value BOOLEAN NOT NULL DEFAULT false,
  plan_required TEXT,  -- NULL | 'starter' | 'professional' | 'enterprise'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
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
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric          TEXT NOT NULL,
  period          TEXT NOT NULL,
  count           INT NOT NULL DEFAULT 0,
  limit_value     INT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, metric, period)
);
CREATE INDEX IF NOT EXISTS org_usage_org_metric_idx ON organization_usage(organization_id, metric);
ALTER TABLE organization_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_usage_tenant_select ON organization_usage;
CREATE POLICY org_usage_tenant_select ON organization_usage FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS org_usage_super_admin_all ON organization_usage;
CREATE POLICY org_usage_super_admin_all ON organization_usage FOR ALL USING (is_current_user_super_admin()) WITH CHECK (true);


-- ----------------------------------------------------------------------------
-- 5. ACTUALIZAR PRECIOS DE LOS PLANES
-- Estos precios deben coincidir EXACTAMENTE con:
--   - src/lib/stripe.ts (PLANS)
--   - src/components/dashboard/sections/BillingSection.tsx (PLANS)
-- ----------------------------------------------------------------------------
-- Inicio:      59€/mes,   566€/año   → descuento 20% (~9.6× mensual)
-- Premium:    119€/mes, 1.142€/año   → descuento 20%
-- Empresarial: 249€/mes, 2.390€/año  → descuento 20%

UPDATE subscription_plans SET
  price_monthly    = 59.00,
  price_yearly     = 566.00,
  max_tables       = 15,
  max_users        = 3,
  max_reservations = 500,
  features         = '{"modules":["reservations","tables","crm","menu","analytics_basic","google_reviews_read","email_auto"],"support":"standard","max_restaurants":1}'::jsonb,
  label            = 'Inicio',
  description      = 'Para restaurantes que empiezan',
  is_active        = true,
  sort_order       = 1
WHERE name = 'starter';

UPDATE subscription_plans SET
  price_monthly    = 119.00,
  price_yearly     = 1142.00,
  max_tables       = 50,
  max_users        = 10,
  max_reservations = NULL,
  features         = '{"modules":["all_basic","tables_premium","table_groups","table_transfer","multi_zone","crm_advanced","campaigns","reputation","ai_responses","whatsapp","shifts","chat","automations"],"support":"priority","max_restaurants":3}'::jsonb,
  label            = 'Premium',
  description      = 'Para restaurantes en crecimiento',
  is_active        = true,
  sort_order       = 2
WHERE name = 'professional';

UPDATE subscription_plans SET
  price_monthly    = 249.00,
  price_yearly     = 2390.00,
  max_tables       = NULL,
  max_users        = NULL,
  max_reservations = NULL,
  features         = '{"modules":["all"],"support":"dedicated","max_restaurants":5,"api":true,"webhooks":true,"multi_company":true,"bi":true,"integrations":true,"account_manager":true,"sla":true,"onboarding":true}'::jsonb,
  label            = 'Empresarial',
  description      = 'Para grupos y cadenas',
  is_active        = true,
  sort_order       = 3
WHERE name = 'enterprise';

-- Si los planes no existían, insertarlos
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


-- ----------------------------------------------------------------------------
-- 6. ASIGNAR TRIAL A ORGANIZACIONES SIN SUSCRIPCIÓN
-- ----------------------------------------------------------------------------
INSERT INTO organization_subscriptions (organization_id, plan_id, billing_cycle, status, trial_ends_at)
SELECT o.id, sp.id, 'monthly', 'trial', now() + interval '30 days'
FROM organizations o, subscription_plans sp
WHERE sp.name = 'professional'
  AND NOT EXISTS (SELECT 1 FROM organization_subscriptions os WHERE os.organization_id = o.id)
ON CONFLICT DO NOTHING;


-- ============================================================================
-- FIN — Ejecuta la verificación siguiente para confirmar que todo está OK:
--
--   SELECT name, label, price_monthly, price_yearly
--   FROM subscription_plans
--   ORDER BY sort_order;
--
-- Resultado esperado:
--    starter       | Inicio       | 59.00  | 566.00
--    professional  | Premium      | 119.00 | 1142.00
--    enterprise    | Empresarial  | 249.00 | 2390.00
-- ============================================================================
