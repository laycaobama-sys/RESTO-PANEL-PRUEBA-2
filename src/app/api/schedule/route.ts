import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("reservation_schedule")
    .select("*")
    .eq("organization_id", user.organizationId)
    .order("day_of_week")
    .order("open_time");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedule: data });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("reservation_schedule")
    .upsert({
      organization_id: user.organizationId,
      day_of_week: body.day_of_week,
      shift: body.shift,
      open_time: body.open_time,
      close_time: body.close_time,
      kitchen_close: body.kitchen_close || null,
      bar_close: body.bar_close || null,
      terrace_close: body.terrace_close || null,
      max_capacity: body.max_capacity || null,
      max_per_zone: body.max_per_zone || {},
      max_per_waiter: body.max_per_waiter || null,
      max_per_kitchen: body.max_per_kitchen || null,
      min_duration_min: body.min_duration_min || 60,
      max_duration_min: body.max_duration_min || 180,
      buffer_min: body.buffer_min || 15,
      cleanup_min: body.cleanup_min || 10,
      min_party_size: body.min_party_size || 1,
      max_party_size: body.max_party_size || 20,
      auto_confirm: body.auto_confirm !== false,
      is_active: body.is_active !== false,
    }, { onConflict: "organization_id,day_of_week,shift" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obligatorio" }, { status: 400 });
  const { error } = await supabaseAdmin
    .from("reservation_schedule")
    .delete()
    .eq("id", id)
    .eq("organization_id", user.organizationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
