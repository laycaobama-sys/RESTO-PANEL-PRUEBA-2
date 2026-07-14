-- ============================================================================
-- RestoPanel · Migración 0022 — Fase 4: IA + Revenue + Marketing + API
-- ============================================================================
-- Idempotente. Ejecutar en Supabase SQL Editor.
-- ============================================================================

-- CRÍTICO: pgcrypto necesita estar activa para digest() y gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 1+2: IA CENTER + PREDICCIONES                               ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- Insights generados por IA (alertas, oportunidades, riesgos)
CREATE TABLE IF NOT EXISTS ai_insights (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  type            text not null,    -- 'opportunity','risk','alert','recommendation','anomaly'
  category        text not null,    -- 'revenue','occupancy','customer','operations','marketing'
  severity        text not null default 'info' check (severity in ('info','warning','critical','success')),
  title           text not null,
  message         text not null,
  prediction      jsonb not null default '{}'::jsonb,  -- {value, confidence, explanation, variables}
  recommended_actions jsonb not null default '[]'::jsonb,
  is_read         boolean not null default false,
  is_dismissed    boolean not null default false,
  valid_until     timestamptz,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS ai_insights_org_idx ON ai_insights(organization_id, created_at desc);
CREATE INDEX IF NOT EXISTS ai_insights_unread_idx ON ai_insights(organization_id, is_read, is_dismissed) WHERE is_read = false;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_insights_tenant_all ON ai_insights;
CREATE POLICY ai_insights_tenant_all ON ai_insights
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- Predicciones diarias agregadas (snapshot)
CREATE TABLE IF NOT EXISTS daily_predictions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  date            date not null,
  predicted_revenue numeric(10,2),
  predicted_covers int,
  predicted_occupancy numeric(5,2),  -- 0-100
  predicted_no_shows int,
  predicted_cancellations int,
  confidence_score numeric(5,2),     -- 0-1
  variables       jsonb not null default '{}'::jsonb,
  model_version   text not null default 'v1',
  created_at      timestamptz not null default now(),
  unique (organization_id, date)
);
CREATE INDEX IF NOT EXISTS daily_predictions_org_date_idx ON daily_predictions(organization_id, date);
ALTER TABLE daily_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_predictions_tenant_select ON daily_predictions;
CREATE POLICY daily_predictions_tenant_select ON daily_predictions
  FOR SELECT USING (organization_id = current_user_org_id() or is_current_user_super_admin());

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 3: REVENUE MANAGEMENT                                       ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS revenue_snapshots (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  period          text not null,  -- 'daily','weekly','monthly','yearly'
  period_start    date not null,
  period_end      date not null,
  revenue_realized numeric(10,2) not null default 0,
  revenue_pending  numeric(10,2) not null default 0,
  revenue_lost     numeric(10,2) not null default 0,    -- no-shows + cancelaciones tardías
  revenue_recovered numeric(10,2) not null default 0,    -- lista de espera + reubicaciones
  revenue_upsell   numeric(10,2) not null default 0,
  covers           int not null default 0,
  avg_ticket       numeric(10,2) not null default 0,
  -- ROI
  roi_campaigns    numeric(5,2),
  roi_reservations numeric(5,2),
  roi_waitlist     numeric(5,2),
  roi_reviews      numeric(5,2),
  roi_whatsapp     numeric(5,2),
  roi_loyalty      numeric(5,2),
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  unique (organization_id, period, period_start)
);
CREATE INDEX IF NOT EXISTS revenue_snapshots_org_idx ON revenue_snapshots(organization_id, period_start desc);
ALTER TABLE revenue_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS revenue_snapshots_tenant_select ON revenue_snapshots;
CREATE POLICY revenue_snapshots_tenant_select ON revenue_snapshots
  FOR SELECT USING (organization_id = current_user_org_id() or is_current_user_super_admin());

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 6: GOOGLE REVIEWS IA                                        ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- Extender google_reviews con campos de IA (solo si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'google_reviews') THEN
    ALTER TABLE google_reviews ADD COLUMN IF NOT EXISTS sentiment text;
    ALTER TABLE google_reviews ADD COLUMN IF NOT EXISTS sentiment_score numeric(5,2);
    ALTER TABLE google_reviews ADD COLUMN IF NOT EXISTS topics text[];
    ALTER TABLE google_reviews ADD COLUMN IF NOT EXISTS keywords_positive text[];
    ALTER TABLE google_reviews ADD COLUMN IF NOT EXISTS keywords_negative text[];
    ALTER TABLE google_reviews ADD COLUMN IF NOT EXISTS ai_response text;
    ALTER TABLE google_reviews ADD COLUMN IF NOT EXISTS ai_response_edited boolean not null default false;
    ALTER TABLE google_reviews ADD COLUMN IF NOT EXISTS is_influencer boolean not null default false;
    ALTER TABLE google_reviews ADD COLUMN IF NOT EXISTS customer_id uuid references customers(id) on delete set null;
    CREATE INDEX IF NOT EXISTS google_reviews_sentiment_idx ON google_reviews(organization_id, sentiment) WHERE sentiment IS NOT NULL;
  END IF;
END $$;

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 7: CAMPAÑAS                                                 ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS campaigns (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  type            text not null check (type in ('email','whatsapp','sms','push','multi')),
  segment         text not null,     -- 'all','vip','dormant','birthday','no_show','high_value','new','at_risk'
  status          text not null default 'draft' check (status in ('draft','scheduled','running','paused','completed','cancelled')),
  subject         text,
  message         text,
  template_id     text,              -- referencia a plantilla
  scheduled_at    timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  -- Métricas
  total_recipients int not null default 0,
  total_sent       int not null default 0,
  total_delivered  int not null default 0,
  total_opened     int not null default 0,
  total_clicked    int not null default 0,
  total_converted  int not null default 0,
  total_unsubscribed int not null default 0,
  total_failed     int not null default 0,
  -- ROI
  cost_eur         numeric(10,2) not null default 0,
  revenue_generated numeric(10,2) not null default 0,
  metadata         jsonb not null default '{}'::jsonb,
  created_by       uuid references users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS campaigns_org_idx ON campaigns(organization_id, created_at desc);
CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns(organization_id, status);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaigns_tenant_all ON campaigns;
CREATE POLICY campaigns_tenant_all ON campaigns
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());
DROP TRIGGER IF EXISTS campaigns_touch ON campaigns;
CREATE TRIGGER campaigns_touch BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Recipientes de campañas (para tracking individual)
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references campaigns(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id     uuid references customers(id) on delete set null,
  channel         text not null,    -- 'email','whatsapp','sms','push'
  recipient       text not null,    -- email o phone
  status          text not null default 'pending' check (status in ('pending','sent','delivered','opened','clicked','converted','failed','unsubscribed')),
  sent_at         timestamptz,
  delivered_at    timestamptz,
  opened_at       timestamptz,
  clicked_at      timestamptz,
  converted_at    timestamptz,
  error           text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS campaign_recipients_campaign_idx ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_recipients_customer_idx ON campaign_recipients(customer_id);
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_recipients_tenant_select ON campaign_recipients;
CREATE POLICY campaign_recipients_tenant_select ON campaign_recipients
  FOR SELECT USING (organization_id = current_user_org_id() or is_current_user_super_admin());

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 12: API PÚBLICA                                             ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS api_keys (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  key_prefix      text not null,    -- primeros 8 chars para identificación
  key_hash        text not null,    -- hash de la API key
  scopes          text[] not null default '{read}'::text[],  -- 'read','write','webhooks'
  is_active       boolean not null default true,
  last_used_at    timestamptz,
  expires_at      timestamptz,
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS api_keys_org_idx ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys(key_hash) WHERE is_active = true;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS api_keys_tenant_all ON api_keys;
CREATE POLICY api_keys_tenant_all ON api_keys
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- Webhooks salientes
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  url             text not null,
  events          text[] not null default '{}'::text[],  -- ['reservation.created', ...]
  secret          text,    -- para firma HMAC
  is_active       boolean not null default true,
  last_triggered_at timestamptz,
  last_response_status int,
  failure_count   int not null default 0,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS webhook_endpoints_org_idx ON webhook_endpoints(organization_id);
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS webhook_endpoints_tenant_all ON webhook_endpoints;
CREATE POLICY webhook_endpoints_tenant_all ON webhook_endpoints
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- Logs de API (rate limiting + auditoría)
CREATE TABLE IF NOT EXISTS api_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  api_key_id      uuid references api_keys(id) on delete set null,
  endpoint        text not null,
  method          text not null,
  status_code     int not null,
  ip_address      text,
  user_agent      text,
  duration_ms     int,
  request_body    jsonb,
  response_body   jsonb,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS api_logs_org_idx ON api_logs(organization_id, created_at desc);
CREATE INDEX IF NOT EXISTS api_logs_api_key_idx ON api_logs(api_key_id, created_at desc);
-- No RLS en api_logs (se gestiona por service_role)

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 11: NOTIFICATION CENTER                                      ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- BLOQUE 11: NOTIFICATION CENTER (solo si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel text default 'in_app';
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url text;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata jsonb not null default '{}'::jsonb;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS icon text;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category text;
  END IF;
END $$;

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 5: MOTOR DE UPSELLING — Recomendaciones                     ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS upsell_recommendations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  reservation_id  uuid references reservations(id) on delete cascade,
  customer_id     uuid references customers(id) on delete set null,
  upsell_item_id  uuid references upsell_items(id) on delete cascade,
  score           numeric(5,2) not null,  -- 0-100
  reason          text,
  reason_vars     jsonb not null default '{}'::jsonb,
  is_shown        boolean not null default false,
  is_accepted     boolean not null default false,
  created_at      timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS upsell_recs_reservation_idx ON upsell_recommendations(reservation_id);
CREATE INDEX IF NOT EXISTS upsell_recs_org_idx ON upsell_recommendations(organization_id, created_at desc);
ALTER TABLE upsell_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS upsell_recs_tenant_all ON upsell_recommendations;
CREATE POLICY upsell_recs_tenant_all ON upsell_recommendations
  FOR ALL USING (organization_id = current_user_org_id() or is_current_user_super_admin())
  WITH CHECK (organization_id = current_user_org_id() or is_current_user_super_admin());

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  FUNCIONES RPC                                                       ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- 1. RPC: generar insight de IA
CREATE OR REPLACE FUNCTION create_ai_insight(
  p_organization_id uuid,
  p_type text,
  p_category text,
  p_severity text,
  p_title text,
  p_message text,
  p_prediction jsonb default '{}'::jsonb,
  p_recommended_actions jsonb default '[]'::jsonb,
  p_valid_until timestamptz default null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO ai_insights (
    organization_id, type, category, severity, title, message,
    prediction, recommended_actions, valid_until
  ) VALUES (
    p_organization_id, p_type, p_category, p_severity, p_title, p_message,
    p_prediction, p_recommended_actions, p_valid_until
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 2. RPC: snapshot de revenue diario
CREATE OR REPLACE FUNCTION snapshot_daily_revenue(p_org_id uuid, p_date date default null)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_date date := coalesce(p_date, current_date);
  v_realized numeric(10,2) := 0;
  v_pending numeric(10,2) := 0;
  v_lost numeric(10,2) := 0;
  v_recovered numeric(10,2) := 0;
  v_upsell numeric(10,2) := 0;
  v_covers int := 0;
BEGIN
  SELECT
    coalesce(sum(estimated_revenue) filter (where status = 'COMPLETED'), 0),
    coalesce(sum(estimated_revenue) filter (where status in ('CONFIRMED','SEATED','PENDING')), 0),
    coalesce(sum(estimated_revenue) filter (where status in ('NO_SHOW','CANCELLED')), 0),
    coalesce(sum(party_size) filter (where status = 'COMPLETED'), 0)
  INTO v_realized, v_pending, v_lost, v_covers
  FROM reservations
  WHERE organization_id = p_org_id AND date::date = v_date;

  SELECT coalesce(sum(total_price), 0) INTO v_upsell
  FROM reservation_upsells
  WHERE organization_id = p_org_id
    AND status = 'DELIVERED'
    AND created_at::date = v_date;

  INSERT INTO revenue_snapshots (
    organization_id, period, period_start, period_end,
    revenue_realized, revenue_pending, revenue_lost, revenue_recovered,
    revenue_upsell, covers, avg_ticket
  ) VALUES (
    p_org_id, 'daily', v_date, v_date,
    v_realized, v_pending, v_lost, v_recovered,
    v_upsell, v_covers,
    case when v_covers > 0 then v_realized / v_covers else 0 end
  ) ON CONFLICT (organization_id, period, period_start) DO UPDATE SET
    revenue_realized = EXCLUDED.revenue_realized,
    revenue_pending = EXCLUDED.revenue_pending,
    revenue_lost = EXCLUDED.revenue_lost,
    revenue_upsell = EXCLUDED.revenue_upsell,
    covers = EXCLUDED.covers,
    avg_ticket = EXCLUDED.avg_ticket;
END;
$$;

-- 3. RPC: hashear API key (usa pgcrypto que ya creamos arriba)
CREATE OR REPLACE FUNCTION hash_api_key(p_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT encode(digest(p_key::bytea, 'sha256'), 'hex');
$$;

-- 4. Seed: insights de ejemplo (no-op si ya existen)
INSERT INTO ai_insights (organization_id, type, category, severity, title, message, prediction, recommended_actions)
SELECT o.id, 'opportunity', 'revenue', 'success',
  'Oportunidad de upselling detectada',
  'El 60% de tus reservas de este viernes no incluyen menú degustación. Ofrecerlo podría generar +180€ adicionales.',
  jsonb_build_object('value', 180, 'confidence', 0.75, 'explanation', 'Basado en históricos de reservas similares'),
  '["Crear campaña de upselling", "Activar recomendación automática en checkout"]'::jsonb
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM ai_insights WHERE organization_id = o.id AND title = 'Oportunidad de upselling detectada'
)
LIMIT 1
ON CONFLICT DO NOTHING;

-- Comments
COMMENT ON TABLE ai_insights IS 'Insights generados por IA: oportunidades, riesgos, alertas, anomalías.';
COMMENT ON TABLE daily_predictions IS 'Predicciones diarias agregadas por organización (revenue, covers, ocupación).';
COMMENT ON TABLE revenue_snapshots IS 'Snapshots de revenue por período (daily/weekly/monthly/yearly) con ROI por canal.';
COMMENT ON TABLE campaigns IS 'Campañas de marketing multi-canal (email/WhatsApp/SMS/push) con segmentación automática.';
COMMENT ON TABLE campaign_recipients IS 'Recipientes de campañas con tracking individual de estado.';
COMMENT ON TABLE api_keys IS 'API keys por organización con scopes (read/write/webhooks).';
COMMENT ON TABLE webhook_endpoints IS 'Webhooks salientes configurables por organización.';
COMMENT ON TABLE api_logs IS 'Logs de API pública para rate limiting y auditoría.';
COMMENT ON TABLE upsell_recommendations IS 'Recomendaciones de upselling generadas por IA por reserva.';

-- ============================================================================
-- FIN
-- ============================================================================
