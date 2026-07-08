import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/session";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { reservationId, newTableId } = body;

  if (!reservationId || !newTableId) {
    return NextResponse.json({ error: "reservationId y newTableId son obligatorios" }, { status: 400 });
  }

  // Verify the new table belongs to this tenant
  const { data: newTable, error: tableError } = await supabaseAdmin
    .from("tables")
    .select("id, number, name, zone, status, capacity")
    .eq("id", newTableId)
    .eq("organization_id", user.organizationId)
    .maybeSingle();

  if (tableError || !newTable) {
    return NextResponse.json({ error: "Mesa de destino no válida" }, { status: 400 });
  }

  // Get the reservation
  const { data: reservation, error: resvError } = await supabaseAdmin
    .from("reservations")
    .select("id, customer_name, party_size, status, table_id, organization_id")
    .eq("id", reservationId)
    .eq("organization_id", user.organizationId)
    .maybeSingle();

  if (resvError || !reservation) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  // Update the reservation with the new table
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
    return NextResponse.json({ error: "Error al traspasar la reserva" }, { status: 500 });
  }

  // Update old table status to AVAILABLE
  if (reservation.table_id) {
    await supabaseAdmin
      .from("tables")
      .update({ status: "AVAILABLE", updated_at: new Date().toISOString() })
      .eq("id", reservation.table_id)
      .eq("organization_id", user.organizationId);
  }

  // Update new table status to RESERVED
  await supabaseAdmin
    .from("tables")
    .update({ status: "RESERVED", updated_at: new Date().toISOString() })
    .eq("id", newTableId)
    .eq("organization_id", user.organizationId);

  // Audit log
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
        from_table: reservation.table_id,
        to_table: newTableId,
        to_table_number: newTable.number,
        to_zone: newTable.zone,
      },
      ip_address: null,
      user_agent: null,
    });
  } catch {}

  return NextResponse.json({
    ok: true,
    message: `Reserva traspasada a Mesa ${newTable.number} (${newTable.zone})`,
    newTable,
  });
}
