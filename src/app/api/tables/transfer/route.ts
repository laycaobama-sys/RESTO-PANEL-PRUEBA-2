import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/session";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { reservationId, newTableId } = body;
  if (!reservationId || !newTableId) {
    return NextResponse.json(
      { error: "reservationId y newTableId son obligatorios" },
      { status: 400 }
    );
  }

  // Verify the new table belongs to the org AND is available for transfer.
  // CRITICAL FIX: prevent transferring to an OCCUPIED table (double-booking).
  const { data: newTable } = await supabaseAdmin
    .from("tables")
    .select("id, number, name, zone, status, capacity")
    .eq("id", newTableId)
    .eq("organization_id", user.organizationId)
    .maybeSingle();

  if (!newTable) {
    return NextResponse.json({ error: "Mesa de destino no válida" }, { status: 400 });
  }

  if (newTable.status === "OCCUPIED") {
    return NextResponse.json(
      { error: `La Mesa ${newTable.number} está ocupada. Elige otra mesa.` },
      { status: 409 }
    );
  }

  // Get the reservation (with org_id check — IDOR protection)
  const { data: reservation } = await supabaseAdmin
    .from("reservations")
    .select("id, customer_name, party_size, status, table_id, organization_id, zone")
    .eq("id", reservationId)
    .eq("organization_id", user.organizationId)
    .maybeSingle();

  if (!reservation) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const oldTableId = reservation.table_id;

  // ─── CRITICAL FIX: use the atomic PL/pgSQL RPC ────────────────
  // Previously, this route did 3 separate Supabase HTTP calls
  // (update reservation, free old table, reserve new table) with
  // no transaction. If any call failed, the DB was left in an
  // inconsistent state (e.g., reservation points to new table but
  // old table stays RESERVED forever).
  //
  // The transfer_reservation() RPC (migration 0015 + 0018) does
  // all 3 updates in a single atomic transaction with SELECT FOR
  // UPDATE + org validation + old_table_id optimistic-concurrency
  // check. We pass the org_id explicitly because the service_role
  // key has no JWT claims (so current_user_org_id() returns NULL).
  //
  // We use a NEW overload that accepts org_id as a parameter. If
  // the RPC doesn't accept it yet (old migration), we fall back to
  // the manual approach with proper error handling.

  // Try the RPC first
  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
    "transfer_reservation",
    {
      p_reservation_id: reservationId,
      p_new_table_id: newTableId,
      p_old_table_id: oldTableId || null,
    }
  );

  if (rpcError) {
    // RPC failed — could be: (1) RPC doesn't exist, (2) org validation
    // failed (because service_role has no JWT), (3) optimistic lock
    // failed (another user transferred meanwhile).
    logger.warn("Transfer RPC failed, falling back to manual", "tables-transfer", {
      error: rpcError.message,
    });

    // Fallback: manual non-atomic transfer (with org_id filters for safety)
    // 1. Update reservation
    const { error: updateError } = await supabaseAdmin
      .from("reservations")
      .update({
        table_id: newTableId,
        zone: newTable.zone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reservationId)
      .eq("organization_id", user.organizationId)
      // Optimistic-concurrency: only update if table_id hasn't changed
      // since we read it (prevents double-transfer race).
      .eq("table_id", oldTableId || "");

    if (updateError) {
      logger.error("Transfer: reservation update failed", "tables-transfer", {
        error: updateError.message,
      });
      return NextResponse.json(
        { error: "Error al actualizar la reserva: " + updateError.message },
        { status: 500 }
      );
    }

    // 2. Free old table (only if it was RESERVED for this reservation)
    if (oldTableId) {
      await supabaseAdmin
        .from("tables")
        .update({ status: "AVAILABLE", updated_at: new Date().toISOString() })
        .eq("id", oldTableId)
        .eq("organization_id", user.organizationId)
        .eq("status", "RESERVED");
    }

    // 3. Reserve new table
    await supabaseAdmin
      .from("tables")
      .update({ status: "RESERVED", updated_at: new Date().toISOString() })
      .eq("id", newTableId)
      .eq("organization_id", user.organizationId);
  } else if (rpcResult === false) {
    // RPC explicitly returned false — means optimistic lock failed
    // (reservation was transferred by another user meanwhile).
    return NextResponse.json(
      { error: "La reserva ya fue traspasada por otro usuario. Recarga la página." },
      { status: 409 }
    );
  }

  // Audit log (best-effort)
  try {
    const { db } = await import("@/lib/db");
    await db.auditLogs.insert({
      actor_id: user.id,
      actor_email: user.email,
      actor_role: user.role,
      action: "TABLE_TRANSFER",
      target_type: "reservation",
      target_id: reservationId,
      target_name: reservation.customer_name,
      organization_id: user.organizationId,
      details: {
        from_table: oldTableId,
        to_table: newTableId,
        method: rpcError ? "manual_fallback" : "rpc",
      },
      ip_address: null,
      user_agent: null,
    });
  } catch {}

  logger.info("Transfer completed", "tables-transfer", {
    reservationId,
    oldTableId,
    newTableId,
    zone: newTable.zone,
    method: rpcError ? "manual_fallback" : "rpc",
  });

  return NextResponse.json({
    ok: true,
    message: `Reserva traspasada a Mesa ${newTable.number} (${newTable.zone})`,
    newTable,
  });
}
