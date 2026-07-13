import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("upsell_items")
    .select("*")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("upsell_items")
    .insert({
      organization_id: user.organizationId,
      name: body.name,
      description: body.description || null,
      category: body.category,
      price: Number(body.price) || 0,
      image_url: body.image_url || null,
      is_active: body.is_active !== false,
      sort_order: body.sort_order || 0,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
