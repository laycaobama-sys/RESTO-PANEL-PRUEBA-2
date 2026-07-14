import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getCustomerProfile } from "@/lib/crm";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const customer = await getCustomerProfile(user.organizationId, id);
  if (!customer) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  return NextResponse.json(customer);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  // Allowlist de campos actualizables (anti mass-assignment)
  const ALLOWED = [
    "name","last_name","email","phone","birthday","anniversary","language",
    "preferred_zone","preferred_table_id","allergies","dietary_restrictions",
    "favorite_drink","favorite_wine","internal_notes","acquisition_channel",
    "tags","marketing_opt_in","vip_status"
  ];
  const updates: any = { updated_at: new Date().toISOString() };
  for (const k of ALLOWED) if (body[k] !== undefined) updates[k] = body[k];

  const { data, error } = await supabaseAdmin
    .from("customers")
    .update(updates)
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  // Soft delete
  const { error } = await supabaseAdmin
    .from("customers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", user.organizationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
