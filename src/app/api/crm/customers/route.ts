import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { listCustomers } from "@/lib/crm";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || undefined;
  const segment = searchParams.get("segment") || undefined;
  const tier = searchParams.get("tier") || undefined;
  const vipOnly = searchParams.get("vip") === "true";
  const limit = Number(searchParams.get("limit") || "50");
  const offset = Number(searchParams.get("offset") || "0");

  const { customers, total } = await listCustomers(user.organizationId, {
    search, segment, tier, vipOnly, limit, offset,
  });
  return NextResponse.json({ customers, total });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const { data, error } = await supabaseAdmin
    .from("customers")
    .insert({
      organization_id: user.organizationId,
      name: body.name,
      last_name: body.last_name || null,
      email: body.email || null,
      phone: body.phone || null,
      birthday: body.birthday || null,
      anniversary: body.anniversary || null,
      language: body.language || "es",
      preferred_zone: body.preferred_zone || null,
      allergies: body.allergies || [],
      dietary_restrictions: body.dietary_restrictions || [],
      favorite_drink: body.favorite_drink || null,
      favorite_wine: body.favorite_wine || null,
      internal_notes: body.internal_notes || null,
      acquisition_channel: body.acquisition_channel || null,
      tags: body.tags || [],
      marketing_opt_in: body.marketing_opt_in !== false,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
