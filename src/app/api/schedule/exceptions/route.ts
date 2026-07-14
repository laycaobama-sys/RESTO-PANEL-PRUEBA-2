import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("schedule_exceptions")
    .select("*")
    .eq("organization_id", user.organizationId)
    .order("date");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ exceptions: data });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("schedule_exceptions")
    .upsert({
      organization_id: user.organizationId,
      date: body.date,
      type: body.type,
      label: body.label || null,
      is_closed: body.is_closed || false,
      open_time: body.open_time || null,
      close_time: body.close_time || null,
      max_capacity: body.max_capacity || null,
      special_rules: body.special_rules || {},
    }, { onConflict: "organization_id,date" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
