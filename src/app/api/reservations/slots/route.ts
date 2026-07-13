import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getAvailableSlots } from "@/lib/reservation-engine";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  const partySize = Number(searchParams.get("partySize") || "2");

  if (!dateStr) {
    return NextResponse.json({ error: "date es obligatorio" }, { status: 400 });
  }

  const date = new Date(dateStr);
  const slots = await getAvailableSlots(user.organizationId, date, partySize);
  return NextResponse.json({ slots });
}
