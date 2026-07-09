-- ============================================================================
-- RestoPanel · Migración 0019 — Correcciones críticas de Phase Audit 2
-- ============================================================================
-- Esta migración parchea los bugs detectados en la segunda auditoría
-- Enterprise (Phases A-M). Es idempotente.
--
-- Correcciones:
--   1. order_items.menu_item_id DROP NOT NULL (0018 lo cambió a SET NULL
--      pero la columna seguía siendo NOT NULL → impossibility).
--   2. update_customer_metrics() — restaurar rama NO_SHOW y CANCELLED
--      que 0018 había eliminado por error.
--   3. UPDATE organizacions existentes con email_verified = true
--      (para no bloquear el login de usuarios demo ya creados).
--   4. UPDATE users existentes con email_verified = true (igual).
-- ============================================================================

-- 1. order_items.menu_item_id debe ser NULLABLE para que el FK
--    ON DELETE SET NULL funcione (0018 cambió el FK pero no la columna).
ALTER TABLE order_items ALTER COLUMN menu_item_id DROP NOT NULL;

-- 2. Restaurar update_customer_metrics() con TODAS las ramas
--    (visits_count + no_shows_count + cancellations_count).
--    La versión de 0018 solo tenía visits_count.
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

  IF v_old_status = v_new_status THEN
    RETURN NEW;
  END IF;

  v_customer_id := NEW.customer_id;
  IF v_customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- visits_count: increment on COMPLETED, decrement on reversal
  IF v_new_status = 'COMPLETED' AND v_old_status != 'COMPLETED' THEN
    UPDATE customers
    SET visits_count = COALESCE(visits_count, 0) + 1,
        last_visit_at = now(),
        updated_at = now()
    WHERE id = v_customer_id;
  END IF;
  IF v_old_status = 'COMPLETED' AND v_new_status != 'COMPLETED' THEN
    UPDATE customers
    SET visits_count = GREATEST(0, COALESCE(visits_count, 1) - 1),
        updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  -- no_shows_count: increment on NO_SHOW (only when transitioning from non-NO_SHOW)
  IF v_new_status = 'NO_SHOW' AND v_old_status != 'NO_SHOW' THEN
    UPDATE customers
    SET no_shows_count = COALESCE(no_shows_count, 0) + 1,
        updated_at = now()
    WHERE id = v_customer_id;
  END IF;
  -- Decrement if reverting from NO_SHOW
  IF v_old_status = 'NO_SHOW' AND v_new_status != 'NO_SHOW' THEN
    UPDATE customers
    SET no_shows_count = GREATEST(0, COALESCE(no_shows_count, 1) - 1),
        updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  -- cancellations_count: increment on CANCELLED (only when transitioning
  -- from a non-terminal state, not from NO_SHOW or COMPLETED)
  IF v_new_status = 'CANCELLED' AND v_old_status NOT IN ('CANCELLED', 'NO_SHOW', 'COMPLETED') THEN
    UPDATE customers
    SET cancellations_count = COALESCE(cancellations_count, 0) + 1,
        updated_at = now()
    WHERE id = v_customer_id;
  END IF;
  -- Decrement if reverting from CANCELLED
  IF v_old_status = 'CANCELLED' AND v_new_status NOT IN ('CANCELLED', 'NO_SHOW', 'COMPLETED') THEN
    UPDATE customers
    SET cancellations_count = GREATEST(0, COALESCE(cancellations_count, 1) - 1),
        updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_customer_metrics IS
  'Updates customer visit/no-show/cancellation counters. Idempotent transitions.';

-- 3. Marcar todos los users existentes como email_verified = true
--    para no bloquear su login tras activar REQUIRE_EMAIL_VERIFICATION.
--    Los nuevos users creados vía /api/auth/register SI deberán verificar.
UPDATE users
SET email_verified = true
WHERE email_verified = false AND is_super_admin = false;

-- 4. Marcar organizaciones existentes como email_verified = true
UPDATE organizations
SET email_verified = true
WHERE email_verified = false;

-- 5. RPC atómica para increment_usage (evita la race condition del
--    read-modify-write en feature-flags.ts).
-- Uso: SELECT increment_usage('org-uuid', 'reservations', '2026-07');
CREATE OR REPLACE FUNCTION increment_usage(
  p_organization_id uuid,
  p_metric text,
  p_period text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO organization_usage (organization_id, metric, period, count, updated_at)
  VALUES (p_organization_id, p_metric, p_period, 1, now())
  ON CONFLICT (organization_id, metric, period)
  DO UPDATE SET count = organization_usage.count + 1, updated_at = now();
END;
$$;

COMMENT ON FUNCTION increment_usage IS
  'Atomic increment of a usage counter. Handles race conditions via ON CONFLICT DO UPDATE.';

-- 6. Alinear esquema de whatsapp_messages con el código
-- El código escribe: customer_id, direction, message_text, wa_message_id, received_at
-- La tabla 0012 tiene: to_phone, body, type, ref_id, attempts, whatsapp_message_id, next_attempt_at
-- Añadimos las columnas que faltan para que ambos esquemas coexistan.
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS direction TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS message_text TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS wa_message_id TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Añadir UNIQUE en wa_message_id (para idempotencia de webhooks)
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_wa_id_uniq
  ON whatsapp_messages(wa_message_id) WHERE wa_message_id IS NOT NULL;

-- 7. Alinear esquema de customers con lo que espera update_customer_metrics
-- La función 0019 actualizada usa no_shows_count y cancellations_count.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS no_shows_count INT NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS cancellations_count INT NOT NULL DEFAULT 0;

-- 8. Caddyfile: bloquear el reverse-proxy abierto en :81
-- (no se puede arreglar desde SQL, se documentará en el reporte)

-- ============================================================================
-- FIN
-- ============================================================================
