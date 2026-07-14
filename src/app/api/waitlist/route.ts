import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { addToWaitlist, getWaitlist, getWaitlistStats } from "@/lib/waitlist";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const [entries, stats] = await Promise.all([
    getWaitlist(user.organizationId),
    getWaitlistStats(user.organizationId),
  ]);
  return NextResponse.json({ entries, stats });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const entry = await addToWaitlist(user.organizationId, {
    customer_name: body.customer_name,
    phone: body.phone,
    email: body.email,
    party_size: Number(body.party_size) || 2,
    children_count: Number(body.children_count) || 0,
    preferred_zone: body.preferred_zone,
    preferred_shift: body.preferred_shift,
    customer_id: body.customer_id,
    vip_status: body.vip_status,
    notes: body.notes,
    source_channel: body.source_channel || 'walk_in',
  });
  if (!entry) return NextResponse.json({ error: "Error al añadir a lista de espera" }, { status: 500 });
  return NextResponse.json(entry, { status: 201 });
}
