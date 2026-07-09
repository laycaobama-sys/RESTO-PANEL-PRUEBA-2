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

  // Verify the new table
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
    .select("id, customer_name, party_size, status, table_id, organization_id, zone")
    .eq("id", reservationId)
    .eq("organization_id", user.organizationId)
    .maybeSingle();

  if (!reservation) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const oldTableId = reservation.table_id;

  // ─── Always use manual transaction (more reliable than RPC) ───
  // 1. Update reservation with new table AND zone
  const { error: updateError } = await supabaseAdmin
    .from("reservations")
    .update({
      table_id: newTableId,
      zone: newTable.zone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reservationId)
    .eq("organization_id", user.organizationId);

  if (updateError) {
    logger.error("Transfer: reservation update failed", "tables-transfer", { error: updateError.message });
    return NextResponse.json({ error: "Error al actualizar la reserva: " + updateError.message }, { status: 500 });
  }

  // Verify the update worked
  const { data: verifyResv } = await supabaseAdmin
    .from("reservations")
    .select("zone, table_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (verifyResv && verifyResv.zone !== newTable.zone) {
    logger.warn("Transfer: zone not updated, forcing update", "tables-transfer", {
      expected: newTable.zone,
      actual: verifyResv.zone,
    });
    // Force update again
    await supabaseAdmin
      .from("reservations")
      .update({ zone: newTable.zone })
      .eq("id", reservationId);
  }

  // 2. Free old table
  if (oldTableId) {
    await supabaseAdmin
      .from("tables")
      .update({ status: "AVAILABLE", updated_at: new Date().toISOString() })
      .eq("id", oldTableId)
      .eq("organization_id", user.organizationId);
  }

  // 3. Reserve new table
  await supabaseAdmin
    .from("tables")
    .update({ status: "RESERVED", updated_at: new Date().toISOString() })
    .eq("id", newTableId)
    .eq("organization_id", user.organizationId);

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

  logger.info("Transfer completed", "tables-transfer", { reservationId, oldTableId, newTableId, zone: newTable.zone });

  return NextResponse.json({
    ok: true,
    message: `Reserva traspasada a Mesa ${newTable.number} (${newTable.zone})`,
    newTable,
  });
}
