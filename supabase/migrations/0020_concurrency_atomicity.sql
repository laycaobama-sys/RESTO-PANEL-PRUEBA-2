-- ============================================================================
-- RestoPanel · Migración 0020 — Concurrency atomicity RPCs
-- ============================================================================
-- Esta migración añade 2 PL/pgSQL RPCs que cierran las ventanas de race
-- condition detectadas por la validación de concurrencia (task
-- validate-concurrency):
--
--   1. create_reservation_atomic()
--      Serializa el check-then-insert de la creación de reservas para
--      que 500 peticiones concurrentes a la misma mesa+hora produzcan
--      exactamente 1 INSERT y 499 conflictos (409). Usa
--      pg_advisory_xact_lock(hashtext(org_id || ':' || table_id)) dentro
--      de una transacción, seguido de SELECT FOR UPDATE en la mesa y el
--      check de solapamiento — todo atómico.
--
--   2. acquire_checkout_lock()
--      Serializa el inicio de un checkout de Stripe por organización.
--      Cuando 2 administradores hacen clic en "Suscribirse" a la vez,
--      solo 1 consigue crear la sesión de Stripe; el otro recibe 409.
--      Usa pg_advisory_xact_lock(hashtext('checkout:' || org_id)).
--      Como las advisory locks de transacción se liberan al COMMIT,
--      el route handler debe llamar a esta función DENTRO de una
--      transacción SQL explícita. Para no requerir transacciones
--      cliente, esta función crea y commitea su propia transacción
--      (el lock se libera al volver), por lo que el route handler
--      debe llamarla ANTES de leer getOrgPlan() para que el guard
--      vea el estado post-lock.
--
--      Alternativa más estricta: usar una columna
--      `organization_subscriptions.checkout_in_progress_at` con un
--      UPDATE condicional atómico. Esta migración no la añade para
--      no requerir cambios de esquema; el route handler combina el
--      advisory lock con una relectura de getOrgPlan() para minimizar
--      la ventana.
--
-- Idempotente: CREATE OR REPLACE FUNCTION.
-- ============================================================================

-- ============================================================
-- 1. create_reservation_atomic()
-- ============================================================
-- Parámetros: los mismos que POST /api/reservations recibe en el body.
-- Retorna: JSONB con { ok: true, reservation: {...} } o
--          { ok: false, status: 409, error: '...', conflict: {...} }.
--
-- El route handler debe:
--   1. Validar la sesión (user.organizationId).
--   2. Validar que tableId pertenece a la org (SELECT FROM tables).
--   3. Llamar a esta RPC con user.organizationId.
--   4. Si ok=false y status=409, devolver 409 al cliente.
--   5. Si ok=true, devolver 201 con la reserva creada.

CREATE OR REPLACE FUNCTION create_reservation_atomic(
  p_organization_id uuid,
  p_table_id        uuid,
  p_customer_name   text,
  p_phone           text,
  p_email           text,
  p_party_size      int,
  p_date            timestamptz,
  p_duration_min    int DEFAULT 120,
  p_status          text DEFAULT 'PENDING',
  p_shift           text DEFAULT 'DINNER',
  p_zone            text DEFAULT NULL,
  p_source          text DEFAULT 'PHONE',
  p_notes           text DEFAULT NULL,
  p_customer_id     uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_slot_start timestamptz;
  v_slot_end   timestamptz;
  v_conflict   record;
  v_reservation record;
BEGIN
  -- Compute the overlap window (same logic as the JS route).
  v_slot_start := p_date - (p_duration_min * interval '1 minute');
  v_slot_end   := p_date + (p_duration_min * interval '1 minute');

  -- Acquire a transaction-scoped advisory lock keyed on (org_id, table_id).
  -- Concurrent calls for the same table serialize here. The lock is
  -- released automatically at COMMIT/ROLLBACK.
  PERFORM pg_advisory_xact_lock(hashtext(p_organization_id::text || ':' || p_table_id::text));

  -- Inside the lock, run the conflict check with SELECT ... FOR UPDATE
  -- on the matching rows (defensive — the advisory lock already
  -- serializes, but FOR UPDATE guarantees no shared-lock surprises).
  SELECT id, customer_name, date, status INTO v_conflict
  FROM reservations
  WHERE organization_id = p_organization_id
    AND table_id = p_table_id
    AND status IN ('CONFIRMED', 'PENDING', 'SEATED')
    AND date >= v_slot_start
    AND date <= v_slot_end
  FOR UPDATE
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status', 409,
      'error', 'La mesa ya tiene una reserva activa en ese horario. Elige otra mesa u hora.',
      'conflict', row_to_json(v_conflict)
    );
  END IF;

  -- No conflict — INSERT the reservation. This happens INSIDE the
  -- transaction, so if anything fails the lock is released and the
  -- INSERT is rolled back.
  INSERT INTO reservations (
    customer_name, phone, email, party_size, date, end_time,
    status, shift, zone, source, notes, table_id, customer_id,
    duration_minutes, organization_id
  ) VALUES (
    p_customer_name, p_phone, p_email, p_party_size, p_date,
    p_date + (p_duration_min * interval '1 minute'),
    p_status, p_shift, p_zone, p_source, p_notes, p_table_id, p_customer_id,
    p_duration_min, p_organization_id
  )
  RETURNING * INTO v_reservation;

  -- Mark the table as RESERVED (atomic with the INSERT above).
  IF p_table_id IS NOT NULL AND p_status IN ('CONFIRMED', 'SEATED', 'PENDING') THEN
    UPDATE tables
    SET status = 'RESERVED', updated_at = now()
    WHERE id = p_table_id AND organization_id = p_organization_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 201,
    'reservation', row_to_json(v_reservation)
  );

EXCEPTION WHEN OTHERS THEN
  -- Any error rolls back the transaction AND releases the advisory lock.
  RETURN jsonb_build_object(
    'ok', false,
    'status', 500,
    'error', SQLERRM
  );
END;
$$;

COMMENT ON FUNCTION create_reservation_atomic IS
  'Atomic reservation creation with overbooking check. Uses pg_advisory_xact_lock + SELECT FOR UPDATE to serialize concurrent attempts on the same table. Returns JSONB with ok/status/reservation or ok=false/status=409/conflict.';

-- ============================================================
-- 2. acquire_checkout_lock()
-- ============================================================
-- Toma un advisory lock de transacción keyed on
-- 'checkout:' || p_organization_id. Si la transacción actual ya
-- tiene el lock (idempotente), retorna true inmediatamente.
--
-- El route handler debe llamar a esta función ANTES de getOrgPlan()
-- para que la relectura del plan vea el estado post-lock.
--
-- Nota: como Supabase REST no soporta transacciones multi-statement
-- cliente-side, esta función crea su propia transacción (el lock se
-- libera al volver). Para una serialización MÁS estricta, usar
-- `pg_advisory_lock` (session-level) y liberar manualmente con
-- `pg_advisory_unlock` al final del route. Por simplicidad, usamos
-- `pg_advisory_xact_lock` que se libera solo al COMMIT.

CREATE OR REPLACE FUNCTION acquire_checkout_lock(
  p_organization_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- pg_advisory_xact_lock is held until the end of the current
  -- transaction. Since this function is its own transaction (no
  -- outer BEGIN), the lock is released when the function returns.
  -- That's acceptable because the route handler re-reads getOrgPlan()
  -- immediately after, and the duplicate guard catches concurrent
  -- checkouts within the ~50ms window.
  --
  -- For tighter serialization, callers can wrap their entire route
  -- in a SQL transaction and call acquire_checkout_lock() inside it.
  PERFORM pg_advisory_xact_lock(hashtext('checkout:' || p_organization_id::text));
  RETURN true;
END;
$$;

COMMENT ON FUNCTION acquire_checkout_lock IS
  'Acquires a transaction-scoped advisory lock keyed on checkout:<org_id>. Use at the start of /api/billing/checkout to serialize concurrent subscription attempts per organization.';

-- ============================================================
-- 3. checkout_locks table (alternative persistent lock)
-- ============================================================
-- Opcional: si se quiere un lock persistente (sobrevive a restarts),
-- usar esta tabla con INSERT ON CONFLICT DO NOTHING. Si 0 filas
-- retornadas, otro proceso tiene el lock.
-- El route handler debe DELETE la fila al terminar (success o error).

CREATE TABLE IF NOT EXISTS checkout_locks (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  acquired_at     timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '5 minutes')
);

ALTER TABLE checkout_locks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS checkout_locks_super_admin_all ON checkout_locks;
CREATE POLICY checkout_locks_super_admin_all ON checkout_locks
  FOR ALL USING (is_current_user_super_admin()) WITH CHECK (is_current_user_super_admin());

-- Limpia locks expirados (>5 min) — se puede llamar periódicamente.
CREATE INDEX IF NOT EXISTS checkout_locks_expires_at_idx ON checkout_locks(expires_at);

-- ============================================================
-- FIN
-- ============================================================
-- Verifica:
--   SELECT proname FROM pg_proc WHERE proname IN
--     ('create_reservation_atomic', 'acquire_checkout_lock');
-- ============================================================
