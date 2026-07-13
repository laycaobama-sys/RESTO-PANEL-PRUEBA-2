import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { recommendUpsells } from "@/lib/upsell-engine";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const recs = await recommendUpsells({
    organizationId: user.organizationId,
    reservationId: body.reservationId,
    customerId: body.customerId,
    partySize: Number(body.partySize) || 2,
    date: new Date(body.date || Date.now()),
    zone: body.zone,
  });
  return NextResponse.json({ recommendations: recs });
}
