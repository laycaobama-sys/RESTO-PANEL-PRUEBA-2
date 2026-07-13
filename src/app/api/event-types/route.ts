import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("event_types")
    .select("*")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ eventTypes: data });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("event_types")
    .insert({
      organization_id: user.organizationId,
      name: body.name,
      description: body.description || null,
      min_party_size: body.min_party_size || 1,
      max_party_size: body.max_party_size || 50,
      duration_min: body.duration_min || 120,
      requires_deposit: body.requires_deposit || false,
      deposit_amount: body.deposit_amount || 0,
      includes_menu: body.includes_menu || false,
      special_rules: body.special_rules || {},
      is_active: true,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
