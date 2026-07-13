import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .eq("organization_id", user.organizationId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();

  // Calcular destinatarios automáticamente según segmento
  let recipientCount = 0;
  if (body.segment === "all") {
    const { count } = await supabaseAdmin
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", user.organizationId)
      .is("deleted_at", null)
      .eq("marketing_opt_in", true);
    recipientCount = count || 0;
  } else if (body.segment === "vip") {
    const { count } = await supabaseAdmin
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", user.organizationId)
      .eq("vip_status", true)
      .eq("marketing_opt_in", true);
    recipientCount = count || 0;
  } else if (body.segment === "birthday") {
    const today = new Date();
    const { count } = await supabaseAdmin
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", user.organizationId)
      .eq("extract(month from birthday)::int", today.getMonth() + 1)
      .eq("extract(day from birthday)::int", today.getDate())
      .eq("marketing_opt_in", true);
    recipientCount = count || 0;
  } else {
    // Para otros segmentos usar la columna segment
    const { count } = await supabaseAdmin
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", user.organizationId)
      .eq("segment", body.segment)
      .eq("marketing_opt_in", true);
    recipientCount = count || 0;
  }

  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .insert({
      organization_id: user.organizationId,
      name: body.name,
      description: body.description || null,
      type: body.type,
      segment: body.segment,
      subject: body.subject || null,
      message: body.message || null,
      scheduled_at: body.scheduled_at || null,
      total_recipients: recipientCount,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
