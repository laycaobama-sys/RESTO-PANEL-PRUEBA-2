import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateStock } from "@/lib/inventory";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  if (body.stock !== undefined) {
    await updateStock(user.organizationId, id, Number(body.stock), body.reason || "Ajuste manual", user.id);
  } else {
    const ALLOWED = ["name","description","category","barcode","stock_min","stock_ideal","unit","purchase_price","sale_price","tax_rate","location","image_url","supplier_id","is_active"];
    const updates: any = {};
    for (const k of ALLOWED) if (body[k] !== undefined) updates[k] = body[k];
    updates.updated_at = new Date().toISOString();
    await supabaseAdmin.from("inventory_items").update(updates).eq("id", id).eq("organization_id", user.organizationId);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  await supabaseAdmin.from("inventory_items").update({ is_active: false }).eq("id", id).eq("organization_id", user.organizationId);
  return NextResponse.json({ ok: true });
}
