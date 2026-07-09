-- ============================================================
-- RestoPanel · Migration 0017 — Billing Enterprise
-- ============================================================

-- 1. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  number          TEXT,
  amount_paid     NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_due      NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'EUR',
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','paid','uncollectible','void')),
  billing_reason  TEXT,
  period_start    TIMESTAMPTZ,
  period_end      TIMESTAMPTZ,
  invoice_pdf_url TEXT,
  hosted_invoice_url TEXT,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_org_idx ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(status);
CREATE INDEX IF NOT EXISTS invoices_created_idx ON invoices(created_at DESC);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_tenant_select ON invoices FOR SELECT USING (organization_id = current_user_org_id());
CREATE POLICY invoices_super_admin_all ON invoices FOR ALL USING (is_current_user_super_admin()) WITH CHECK (true);

-- 2. PAYMENT METHODS
CREATE TABLE IF NOT EXISTS payment_methods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT UNIQUE,
  type            TEXT NOT NULL DEFAULT 'card',
  brand           TEXT,
  last4           TEXT,
  exp_month       INT,
  exp_year        INT,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_methods_org_idx ON payment_methods(organization_id);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY pm_tenant_select ON payment_methods FOR SELECT USING (organization_id = current_user_org_id());
CREATE POLICY pm_super_admin_all ON payment_methods FOR ALL USING (is_current_user_super_admin()) WITH CHECK (true);

-- 3. SUBSCRIPTION HISTORY
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
CREATE POLICY sh_tenant_select ON subscription_history FOR SELECT USING (organization_id = current_user_org_id());
CREATE POLICY sh_super_admin_all ON subscription_history FOR ALL USING (is_current_user_super_admin()) WITH CHECK (true);

-- 4. USAGE LOGS
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
CREATE POLICY ul_tenant_select ON usage_logs FOR SELECT USING (organization_id = current_user_org_id());
CREATE POLICY ul_super_admin_all ON usage_logs FOR ALL USING (is_current_user_super_admin()) WITH CHECK (true);

-- 5. Update subscription_plans with correct pricing
UPDATE subscription_plans SET 
  price_monthly = 59.00, 
  price_yearly = 590.00,
  max_tables = 15,
  max_users = 3,
  max_reservations = 500,
  features = '{"modules":["reservations","tables","crm","menu","analytics_basic","google_reviews_read","email_auto"],"support":"standard","max_restaurants":1}'::jsonb,
  label = 'Inicio',
  description = 'Para restaurantes que empiezan'
WHERE name = 'starter';

UPDATE subscription_plans SET 
  price_monthly = 119.00, 
  price_yearly = 1190.00,
  max_tables = 50,
  max_users = 10,
  max_reservations = NULL,
  features = '{"modules":["all_basic","tables_premium","table_groups","table_transfer","multi_zone","crm_advanced","campaigns","reputation","ai_responses","whatsapp","shifts","chat","automations"],"support":"priority","max_restaurants":3}'::jsonb,
  label = 'Premium',
  description = 'Para restaurantes en crecimiento'
WHERE name = 'professional';

UPDATE subscription_plans SET 
  price_monthly = 249.00, 
  price_yearly = 2490.00,
  max_tables = NULL,
  max_users = NULL,
  max_reservations = NULL,
  features = '{"modules":["all"],"support":"dedicated","max_restaurants":5,"api":true,"webhooks":true,"multi_company":true,"bi":true,"integrations":true,"account_manager":true,"sla":true,"onboarding":true}'::jsonb,
  label = 'Empresarial',
  description = 'Para grupos y cadenas'
WHERE name = 'enterprise';

-- 6. Add stripe columns to organization_subscriptions
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

-- 7. Add extra_restaurants column to organization_subscriptions
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS extra_restaurants INT NOT NULL DEFAULT 0;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS extra_restaurant_price NUMERIC(10,2) NOT NULL DEFAULT 49.00;

COMMENT ON TABLE invoices IS 'Stripe invoices synced via webhooks. Downloadable PDFs available.';
COMMENT ON TABLE payment_methods IS 'Customer payment methods synced from Stripe.';
COMMENT ON TABLE subscription_history IS 'Audit trail of all subscription changes (upgrades, downgrades, cancellations).';
COMMENT ON TABLE usage_logs IS 'Per-metric usage tracking for quota enforcement.';
