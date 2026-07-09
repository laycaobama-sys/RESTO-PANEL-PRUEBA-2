-- ============================================================
-- RestoPanel · Migration 0015 — Atomic transfer RPC + email queue
-- ============================================================

-- 1. Atomic transfer reservation function
CREATE OR REPLACE FUNCTION transfer_reservation(
  p_reservation_id UUID,
  p_old_table_id UUID,
  p_new_table_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_reservation RECORD;
  v_new_table RECORD;
BEGIN
  -- Get reservation
  SELECT * INTO v_reservation FROM reservations WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Reserva no encontrada');
  END IF;

  -- Get new table
  SELECT * INTO v_new_table FROM tables WHERE id = p_new_table_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Mesa de destino no encontrada');
  END IF;

  -- 1. Update reservation to new table
  UPDATE reservations
  SET table_id = p_new_table_id,
      zone = v_new_table.zone,
      updated_at = now()
  WHERE id = p_reservation_id;

  -- 2. Free old table
  IF p_old_table_id IS NOT NULL THEN
    UPDATE tables SET status = 'AVAILABLE', updated_at = now()
    WHERE id = p_old_table_id;
  END IF;

  -- 3. Reserve new table
  UPDATE tables SET status = 'RESERVED', updated_at = now()
  WHERE id = p_new_table_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Reserva traspasada a Mesa ' || v_new_table.number || ' (' || v_new_table.zone || ')',
    'new_table', row_to_json(v_new_table)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Email queue table
CREATE TABLE IF NOT EXISTS email_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email        TEXT NOT NULL,
  subject         TEXT NOT NULL,
  html_body       TEXT,
  text_body       TEXT,
  from_email      TEXT NOT NULL DEFAULT 'RestoPanel <noreply@restopanel.com>',
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'delivered', 'bounced', 'failed')),
  attempts        INT NOT NULL DEFAULT 0,
  max_attempts    INT NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error      TEXT,
  resend_id       TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_queue_status_idx ON email_queue(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS email_queue_org_idx ON email_queue(organization_id);

ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_queue_tenant_select ON email_queue FOR SELECT USING (organization_id = current_user_org_id());
CREATE POLICY email_queue_super_admin_all ON email_queue FOR ALL USING (is_current_user_super_admin()) WITH CHECK (true);

-- 3. Feature flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT NOT NULL UNIQUE,
  label           TEXT NOT NULL,
  description     TEXT,
  default_value   BOOLEAN NOT NULL DEFAULT false,
  plan_required   TEXT,  -- 'starter', 'professional', 'enterprise', or NULL for all
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY feature_flags_select ON feature_flags FOR SELECT USING (true);

-- Seed feature flags
INSERT INTO feature_flags (key, label, description, default_value, plan_required) VALUES
  ('reservations', 'Reservas', 'Módulo de reservas', true, NULL),
  ('tables', 'Mesas', 'Plano de sala interactivo', true, NULL),
  ('crm', 'CRM', 'Gestión de clientes', true, NULL),
  ('menu', 'Carta digital', 'Gestión de carta', true, NULL),
  ('analytics', 'Analíticas', 'Métricas y reportes', true, 'professional'),
  ('chat', 'Chat interno', 'Chat entre equipos', true, 'professional'),
  ('shifts', 'Turnos', 'Gestión de turnos del personal', true, 'professional'),
  ('kitchen', 'Cocina (KDS)', 'Kitchen Display System', true, 'professional'),
  ('whatsapp', 'WhatsApp Business', 'Mensajería WhatsApp', false, 'professional'),
  ('web_import', 'Importación web', 'Importar carta desde web', true, 'professional'),
  ('google_reviews', 'Gestión de reseñas', 'Panel de Google Reviews', true, 'professional'),
  ('advanced_analytics', 'Analíticas avanzadas', 'Reportes detallados y exportación', false, 'enterprise'),
  ('api_access', 'Acceso API', 'API pública para integraciones', false, 'enterprise'),
  ('white_label', 'Marca blanca', 'Personalización de marca', false, 'enterprise')
ON CONFLICT (key) DO NOTHING;

-- 4. Usage tracking table (for Phase 2 quotas)
CREATE TABLE IF NOT EXISTS organization_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric          TEXT NOT NULL,  -- 'reservations', 'tables', 'users', 'api_calls'
  period          TEXT NOT NULL,  -- '2026-07' format
  count           INT NOT NULL DEFAULT 0,
  limit_value     INT,  -- NULL = unlimited
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, metric, period)
);

CREATE INDEX IF NOT EXISTS org_usage_org_metric_idx ON organization_usage(organization_id, metric);

ALTER TABLE organization_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_usage_tenant_select ON organization_usage FOR SELECT USING (organization_id = current_user_org_id());
CREATE POLICY org_usage_super_admin_all ON organization_usage FOR ALL USING (is_current_user_super_admin()) WITH CHECK (true);

-- 5. Enhanced audit log (add before/after, endpoint, execution_time)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS before_data JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS after_data JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS endpoint TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS execution_time_ms INT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS result TEXT DEFAULT 'success';

COMMENT ON FUNCTION transfer_reservation IS 'Atomic transfer of a reservation between tables. All 3 operations (update reservation, free old table, reserve new table) happen in a single transaction with automatic rollback on failure.';
