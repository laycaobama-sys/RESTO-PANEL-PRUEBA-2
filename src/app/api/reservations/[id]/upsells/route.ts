import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("reservation_upsells")
    .select("*, upsell_items(name, category)")
    .eq("reservation_id", id)
    .eq("organization_id", user.organizationId)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ upsells: data });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const { upsellItemId, quantity } = body;
  if (!upsellItemId) return NextResponse.json({ error: "upsellItemId obligatorio" }, { status: 400 });

  // Cargar upsell item para obtener precio
  const { data: item, error: itemErr } = await supabaseAdmin
    .from("upsell_items")
    .select("price, is_active")
    .eq("id", upsellItemId)
    .eq("organization_id", user.organizationId)
    .maybeSingle();
  if (itemErr || !item || !item.is_active) {
    return NextResponse.json({ error: "Item no válido" }, { status: 400 });
  }

  const qty = Number(quantity) || 1;
  const unitPrice = Number(item.price);
  const totalPrice = unitPrice * qty;

  const { data, error } = await supabaseAdmin
    .from("reservation_upsells")
    .insert({
      reservation_id: id,
      organization_id: user.organizationId,
      upsell_item_id: upsellItemId,
      quantity: qty,
      unit_price: unitPrice,
      total_price: totalPrice,
      status: "CONFIRMED",
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Añadir al timeline
  await supabaseAdmin.from("reservation_timeline").insert({
    reservation_id: id,
    organization_id: user.organizationId,
    event_type: "upsell_added",
    message: `Añadido upsell (${qty}x)`,
    actor: "customer",
    metadata: { upsell_item_id: upsellItemId, total_price: totalPrice },
  });

  return NextResponse.json(data, { status: 201 });
}
