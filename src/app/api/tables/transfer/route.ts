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
    return NextResponse.json({ error: "reservationId y newTableId son obligatorios" }, { status: 400 });
  }

  // Verify the new table belongs to this tenant
  const { data: newTable } = await supabaseAdmin
    .from("tables")
    .select("id, number, name, zone, status, capacity")
    .eq("id", newTableId)
    .eq("organization_id", user.organizationId)
    .maybeSingle();

  if (!newTable) {
    return NextResponse.json({ error: "Mesa de destino no válida" }, { status: 400 });
  }

  // Get the reservation
  const { data: reservation } = await supabaseAdmin
    .from("reservations")
    .select("id, customer_name, party_size, status, table_id, organization_id")
    .eq("id", reservationId)
    .eq("organization_id", user.organizationId)
    .maybeSingle();

  if (!reservation) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const oldTableId = reservation.table_id;

  // ─── Try atomic RPC ──────────────────────────────────────
  try {
    const { data: rpcResult, error: rpcError } = await supabaseAdmin
      .rpc("transfer_reservation", {
        p_reservation_id: reservationId,
        p_old_table_id: oldTableId,
        p_new_table_id: newTableId,
      });

    if (!rpcError && rpcResult) {
      const result = typeof rpcResult === "string" ? JSON.parse(rpcResult) : rpcResult;
      if (result.ok || result === true) {
        logger.info("Transfer via RPC", "tables-transfer", { reservationId, oldTableId, newTableId });
        // Audit log
        try {
          const { db } = await import("@/lib/db");
          await db.auditLogs.insert({
            actor_id: user.id, actor_email: user.email, actor_role: user.role,
            action: "TABLE_TRANSFER", target_type: "reservation", target_id: reservationId,
            target_name: reservation.customer_name, organization_id: user.organizationId,
            details: { from_table: oldTableId, to_table: newTableId, method: "rpc" },
            ip_address: null, user_agent: null,
          });
        } catch {}
        return NextResponse.json({ ok: true, message: `Reserva traspasada a Mesa ${newTable.number} (${newTable.zone})`, newTable });
      }
      // RPC returned ok=false — fall through to manual
      logger.warn("RPC returned error, using manual", "tables-transfer", { result });
    }
    // rpcError or no result — fall through to manual
  } catch (e: any) {
    logger.warn("RPC exception, using manual", "tables-transfer", { error: e.message });
  }

  // ─── Manual transaction (fallback) ──────────────────────
  logger.info("Using manual transfer", "tables-transfer", { reservationId, oldTableId, newTableId });

  // 1. Update reservation
  const { error: updateError } = await supabaseAdmin
    .from("reservations")
    .update({ table_id: newTableId, zone: newTable.zone, updated_at: new Date().toISOString() })
    .eq("id", reservationId)
    .eq("organization_id", user.organizationId);

  if (updateError) {
    logger.error("Transfer: reservation update failed", "tables-transfer", { error: updateError.message });
    return NextResponse.json({ error: "Error al actualizar la reserva: " + updateError.message }, { status: 500 });
  }

  // 2. Free old table
  if (oldTableId) {
    const { error: oldTableError } = await supabaseAdmin
      .from("tables")
      .update({ status: "AVAILABLE", updated_at: new Date().toISOString() })
      .eq("id", oldTableId)
      .eq("organization_id", user.organizationId);
    if (oldTableError) logger.warn("Transfer: old table update failed", "tables-transfer", { error: oldTableError.message });
  }

  // 3. Reserve new table
  const { error: newTableError } = await supabaseAdmin
    .from("tables")
    .update({ status: "RESERVED", updated_at: new Date().toISOString() })
    .eq("id", newTableId)
    .eq("organization_id", user.organizationId);
  if (newTableError) logger.warn("Transfer: new table update failed", "tables-transfer", { error: newTableError.message });

  // Audit log
  try {
    const { db } = await import("@/lib/db");
    await db.auditLogs.insert({
      actor_id: user.id, actor_email: user.email, actor_role: user.role,
      action: "TABLE_TRANSFER", target_type: "reservation", target_id: reservationId,
      target_name: reservation.customer_name, organization_id: user.organizationId,
      details: { from_table: oldTableId, to_table: newTableId, method: "manual" },
      ip_address: null, user_agent: null,
    });
  } catch {}

  logger.info("Transfer completed via manual", "tables-transfer", { reservationId, oldTableId, newTableId });

  return NextResponse.json({
    ok: true,
    message: `Reserva traspasada a Mesa ${newTable.number} (${newTable.zone})`,
    newTable,
  });
}
