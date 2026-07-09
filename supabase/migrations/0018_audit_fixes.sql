-- ============================================================================
-- RestoPanel · Migración 0018 — Correcciones críticas de auditoría
-- ============================================================================
-- Esta migración parchea TODOS los bugs detectados en la auditoría:
--
--   1. Recursión RLS en policies inline de 0003 (usaban
--      `exists (select 1 from users u where u.id = auth.uid() ...)`
--      en lugar de is_current_user_super_admin()).
--   2. transfer_reservation() no validaba organización ni tabla origen.
--   3. order_items.menu_item_id era ON DELETE CASCADE (borraba historial).
--   4. update_customer_metrics() no decrementaba al revertir estado.
--   5. tables.group_id no tenía FK (table_groups no existía).
--   6. Falta UNIQUE en subscription_history para idempotencia webhook.
--   7. Faltan índices en FKs críticas.
--   8. Faltan triggers touch_updated_at() en 11 tablas.
--   9. Faltan UNIQUE en customers(organization_id, phone/email).
--  10. Faltan CHECK constraints en columnas tipo enum.
--  11. Faltan policies DELETE en varias tablas.
--  12. subscription_plans: añadir UNIQUE en stripe_price_id_monthly/yearly.
--
-- Es idempotente: se puede ejecutar varias veces sin error.
-- ============================================================================

-- ============================================================
-- 1. ELIMINAR Y RECREAR POLICIES RECURSIVAS DE 0003
-- ============================================================
-- Las policies originales usaban `exists (select 1 from users u where u.id = auth.uid() and u.is_super_admin = true)`
-- que causa recursión infinita porque la policy sobre `users` también llama a la policy sobre `users`.
-- Las reescribimos usando is_current_user_super_admin() que lee del JWT (sin tocar public.users).

-- audit_logs
DROP POLICY IF EXISTS audit_logs_super_admin_select ON audit_logs;
DROP POLICY IF EXISTS audit_logs_super_admin_insert ON audit_logs;
DROP POLICY IF EXISTS audit_logs_super_admin_update ON audit_logs;
DROP POLICY IF EXISTS audit_logs_super_admin_delete ON audit_logs;
CREATE POLICY audit_logs_super_admin_select ON audit_logs
  FOR SELECT USING (is_current_user_super_admin());
CREATE POLICY audit_logs_super_admin_insert ON audit_logs
  FOR INSERT WITH CHECK (is_current_user_super_admin());
CREATE POLICY audit_logs_super_admin_update ON audit_logs
  FOR UPDATE USING (is_current_user_super_admin()) WITH CHECK (is_current_user_super_admin());
CREATE POLICY audit_logs_super_admin_delete ON audit_logs
  FOR DELETE USING (is_current_user_super_admin());

-- users — super_admin policies (no recursivas)
DROP POLICY IF EXISTS users_super_admin_select ON users;
DROP POLICY IF EXISTS users_super_admin_insert ON users;
DROP POLICY IF EXISTS users_super_admin_update ON users;
DROP POLICY IF EXISTS users_super_admin_delete ON users;
CREATE POLICY users_super_admin_select ON users
  FOR SELECT USING (is_current_user_super_admin());
CREATE POLICY users_super_admin_insert ON users
  FOR INSERT WITH CHECK (is_current_user_super_admin());
CREATE POLICY users_super_admin_update ON users
  FOR UPDATE USING (is_current_user_super_admin()) WITH CHECK (is_current_user_super_admin());
CREATE POLICY users_super_admin_delete ON users
  FOR DELETE USING (is_current_user_super_admin());

-- organizations — super_admin policies
DROP POLICY IF EXISTS organizations_super_admin_all ON organizations;
CREATE POLICY organizations_super_admin_all ON organizations
  FOR ALL USING (is_current_user_super_admin()) WITH CHECK (is_current_user_super_admin());

-- Dynamic loop: replace any policy that still uses the recursive
-- `exists (select 1 from users ...)` pattern with the helper function.
DO $$
DECLARE
  t text;
  policies_record record;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'categories','menu_items','tables','orders','order_items',
    'reservations','organization_settings','verification_tokens'
  ])
  LOOP
    FOR policies_record IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND qual LIKE '%exists (select 1 from users u where u.id = auth.uid() and u.is_super_admin = true)%'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', policies_record.policyname, t);
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL USING (organization_id = current_user_org_id() OR is_current_user_super_admin()) WITH CHECK (organization_id = current_user_org_id() OR is_current_user_super_admin());',
        replace(policies_record.policyname, '_select', '_all'),
        t
      );
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- 2. REESCRIBIR transfer_reservation() CON VALIDACIÓN DE ORG
-- ============================================================
-- Antes: cualquier usuario podía mover una reserva de cualquier tenant.
-- Ahora: valida que la reserva, mesa origen y mesa destino pertenezcan
-- a la organización del JWT actual.
--
-- NOTA: PostgreSQL NO permite cambiar nombres de parámetros con
-- CREATE OR REPLACE FUNCTION. Hay que hacer DROP primero.
-- Usamos la signatura completa (uuid, uuid, uuid) para no afectar
-- a otras posibles versiones de la función.

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
  -- Get the caller's organization from the JWT claim.
  v_org_id := current_user_org_id();
  IF v_org_id IS NULL AND NOT is_current_user_super_admin() THEN
    RAISE EXCEPTION 'No organization context';
  END IF;

  -- Load the reservation (must exist).
  SELECT * INTO v_reservation
  FROM reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;

  -- Org isolation: the reservation must belong to the caller's org
  -- (unless super admin).
  IF v_org_id IS NOT NULL AND v_reservation.organization_id != v_org_id THEN
    RAISE EXCEPTION 'Forbidden: reservation does not belong to your organization';
  END IF;

  -- If p_old_table_id was provided, it must match the reservation's
  -- current table_id (prevents race conditions where two clients
  -- transfer the same reservation simultaneously).
  IF p_old_table_id IS NOT NULL AND v_reservation.table_id IS NOT NULL
     AND p_old_table_id::text != v_reservation.table_id::text THEN
    RAISE EXCEPTION 'Old table id does not match reservation''s current table';
  END IF;

  -- Load the new table (must exist and belong to the same org).
  SELECT * INTO v_new_table
  FROM tables
  WHERE id = p_new_table_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target table not found';
  END IF;

  IF v_org_id IS NOT NULL AND v_new_table.organization_id != v_org_id THEN
    RAISE EXCEPTION 'Forbidden: target table does not belong to your organization';
  END IF;

  -- All three operations in a single transaction (atomic):
  -- 1. Update reservation to point to new table.
  -- 2. Free the old table (mark AVAILABLE) — only if it had this reservation.
  -- 3. Mark the new table as RESERVED.
  UPDATE reservations
  SET table_id = p_new_table_id, updated_at = now()
  WHERE id = p_reservation_id;

  IF v_reservation.table_id IS NOT NULL THEN
    UPDATE tables
    SET status = 'AVAILABLE', updated_at = now()
    WHERE id = v_reservation.table_id
      AND organization_id = v_reservation.organization_id;
  END IF;

  UPDATE tables
  SET status = 'RESERVED', updated_at = now()
  WHERE id = p_new_table_id
    AND organization_id = v_reservation.organization_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION transfer_reservation IS 'Atomic transfer of a reservation between tables. Validates org ownership. All 3 operations (update reservation, free old table, reserve new table) happen in a single transaction with automatic rollback on failure.';

-- ============================================================
-- 3. order_items.menu_item_id: ON DELETE SET NULL (no CASCADE)
-- ============================================================
-- Borra el FK viejo y crea uno nuevo con SET NULL para que borrar
-- un plato NO destruya el historial de pedidos.

ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_menu_item_id_fkey;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_menu_item_id_fkey
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
  ON DELETE SET NULL;

-- ============================================================
-- 4. update_customer_metrics() con decremento al revertir
-- ============================================================
-- Versión corregida: si una reserva pasa de COMPLETED a CANCELLED,
-- resta 1 del contador visits_count (en lugar de solo sumar).
--
-- NOTA: Mismo problema que con transfer_reservation — DROP IF EXISTS
-- primero para evitar el error 42P13 si la función existía con otra
-- signatura. CASCADE por si había triggers asociados.

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

  -- Only proceed if status changed.
  IF v_old_status = v_new_status THEN
    RETURN NEW;
  END IF;

  -- Find the customer (reservations store customer_id if linked).
  v_customer_id := NEW.customer_id;
  IF v_customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Increment when entering COMPLETED.
  IF v_new_status = 'COMPLETED' AND v_old_status != 'COMPLETED' THEN
    UPDATE customers
    SET visits_count = COALESCE(visits_count, 0) + 1,
        last_visit_at = now(),
        updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  -- Decrement when leaving COMPLETED (e.g., reversal/correction).
  IF v_old_status = 'COMPLETED' AND v_new_status != 'COMPLETED' THEN
    UPDATE customers
    SET visits_count = GREATEST(0, COALESCE(visits_count, 1) - 1),
        updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Recrear los 2 triggers que el DROP FUNCTION ... CASCADE borró
-- (los había creado 0006_crm_customers.sql).
DROP TRIGGER IF EXISTS reservations_update_customer_metrics ON reservations;
CREATE TRIGGER reservations_update_customer_metrics
  AFTER UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_customer_metrics();

DROP TRIGGER IF EXISTS reservations_insert_customer_metrics ON reservations;
CREATE TRIGGER reservations_insert_customer_metrics
  AFTER INSERT ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_customer_metrics();

-- ============================================================
-- 5. CREAR TABLA table_groups (FALTABA) + FK EN tables.group_id
-- ============================================================
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
  FOR SELECT USING (organization_id = current_user_org_id() or is_current_user_super_admin());
DROP POLICY IF EXISTS table_groups_tenant_insert ON table_groups;
CREATE POLICY table_groups_tenant_insert ON table_groups
  FOR INSERT WITH CHECK (organization_id = current_user_org_id());
DROP POLICY IF EXISTS table_groups_tenant_update ON table_groups;
CREATE POLICY table_groups_tenant_update ON table_groups
  FOR UPDATE USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS table_groups_tenant_delete ON table_groups;
CREATE POLICY table_groups_tenant_delete ON table_groups
  FOR DELETE USING (organization_id = current_user_org_id());

-- Añadir FK a tables.group_id (antes era una columna suelta)
-- Primero eliminamos cualquier dato huérfano
UPDATE tables SET group_id = NULL
WHERE group_id IS NOT NULL
  AND group_id NOT IN (SELECT id FROM table_groups);

ALTER TABLE tables
  DROP CONSTRAINT IF EXISTS tables_group_id_fkey;

ALTER TABLE tables
  ADD CONSTRAINT tables_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES table_groups(id)
  ON DELETE SET NULL;

-- ============================================================
-- 6. UNIQUE EN subscription_history PARA IDEMPOTENCIA WEBHOOK
-- ============================================================
-- Stripe reenvía eventos cuando recibe 500. Necesitamos un UNIQUE
-- compuesto para que el ON CONFLICT del webhook funcione.
CREATE UNIQUE INDEX IF NOT EXISTS subscription_history_org_event_details_uniq
  ON subscription_history(organization_id, event_type, details);

-- UNIQUE en invoices.stripe_invoice_id (ya tiene UNIQUE en la tabla)
-- UNIQUE en payment_methods.stripe_payment_method_id (ya tiene UNIQUE en la tabla)

-- UNIQUE en subscription_plans.stripe_price_id_monthly/yearly
-- (para que el webhook pueda resolver plan_id por price_id sin ambigüedad)
CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_stripe_price_monthly_uniq
  ON subscription_plans(stripe_price_id_monthly)
  WHERE stripe_price_id_monthly IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_stripe_price_yearly_uniq
  ON subscription_plans(stripe_price_id_yearly)
  WHERE stripe_price_id_yearly IS NOT NULL;

-- ============================================================
-- 7. ÍNDICES FALTANTES EN FKs CRÍTICAS
-- ============================================================
CREATE INDEX IF NOT EXISTS order_items_menu_item_id_idx ON order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS orders_table_id_idx ON orders(table_id);
CREATE INDEX IF NOT EXISTS reservations_table_id_idx ON reservations(table_id);
CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS role_permissions_permission_id_idx ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS user_roles_role_id_idx ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);
CREATE INDEX IF NOT EXISTS reservations_customer_id_idx ON reservations(customer_id);
CREATE INDEX IF NOT EXISTS menu_items_category_id_idx ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS reservations_status_idx ON reservations(status);
CREATE INDEX IF NOT EXISTS reservations_date_idx ON reservations(date);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at desc);

-- ============================================================
-- 8. TRIGGERS touch_updated_at() FALTANTES
-- ============================================================
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'zones','customers','customer_tags','staff_shifts','chat_channels',
    'subscription_plans','feature_flag_overrides','system_settings',
    'email_queue','organization_usage','invoices','table_groups'
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

-- ============================================================
-- 9. UNIQUE EN customers(organization_id, phone) y (organization_id, email)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS customers_org_phone_uniq
  ON customers(organization_id, phone)
  WHERE phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_org_email_uniq
  ON customers(organization_id, email)
  WHERE email IS NOT NULL;

-- ============================================================
-- 10. CHECK CONSTRAINTS EN COLUMNAS TIPO ENUM
-- ============================================================
-- (Solo añadimos los más críticos; el resto se mantiene con validación de app.)

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('SUPER_ADMIN','ADMIN','STAFF'));

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('PENDING','PREPARING','SERVED','COMPLETED','CANCELLED'));

ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE reservations
  ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('PENDING','CONFIRMED','SEATED','COMPLETED','CANCELLED','NO_SHOW'));

ALTER TABLE tables
  DROP CONSTRAINT IF EXISTS tables_status_check;
ALTER TABLE tables
  ADD CONSTRAINT tables_status_check
  CHECK (status IN ('AVAILABLE','OCCUPIED','RESERVED','PREPARING','OUT_OF_SERVICE'));

-- ============================================================
-- 11. POLICIES DELETE FALTANTES
-- ============================================================
-- notifications
DROP POLICY IF EXISTS notifications_tenant_delete ON notifications;
CREATE POLICY notifications_tenant_delete ON notifications
  FOR DELETE USING (organization_id = current_user_org_id() or is_current_user_super_admin());

-- chat_channels
DROP POLICY IF EXISTS chat_channels_tenant_delete ON chat_channels;
CREATE POLICY chat_channels_tenant_delete ON chat_channels
  FOR DELETE USING (organization_id = current_user_org_id() or is_current_user_super_admin());

-- chat_messages
DROP POLICY IF EXISTS chat_messages_tenant_delete ON chat_messages;
CREATE POLICY chat_messages_tenant_delete ON chat_messages
  FOR DELETE USING (organization_id = current_user_org_id() or is_current_user_super_admin());

-- import_jobs
DROP POLICY IF EXISTS import_jobs_tenant_delete ON import_jobs;
CREATE POLICY import_jobs_tenant_delete ON import_jobs
  FOR DELETE USING (organization_id = current_user_org_id() or is_current_user_super_admin());

-- ============================================================
-- 12. COMMENTS
-- ============================================================
COMMENT ON TABLE table_groups IS 'Groups of tables for zone management (e.g., Terrace A, VIP, Bar). Each group belongs to one organization.';
COMMENT ON FUNCTION transfer_reservation IS 'Atomic transfer of a reservation between tables. Validates org ownership and old table id.';
COMMENT ON FUNCTION update_customer_metrics IS 'Updates customer visit counters. Increments on COMPLETED, decrements when reverting from COMPLETED.';

-- ============================================================
-- FIN — Verifica con:
--   SELECT * FROM pg_policies WHERE tablename = 'users' ORDER BY policyname;
--   SELECT * FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE '%_uniq';
-- ============================================================
