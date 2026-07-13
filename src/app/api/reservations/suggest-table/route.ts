import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { suggestTables, type AssignmentContext } from "@/lib/table-ai";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { partySize, date, durationMin, preferredZone, customerId, childrenCount, accessibilityNeeded } = body;

  if (!partySize || !date) {
    return NextResponse.json({ error: "partySize y date son obligatorios" }, { status: 400 });
  }

  const ctx: AssignmentContext = {
    organizationId: user.organizationId,
    partySize: Number(partySize),
    date: new Date(date),
    durationMin: Number(durationMin) || 120,
    preferredZone: preferredZone || undefined,
    customerId: customerId || undefined,
    childrenCount: Number(childrenCount) || 0,
    accessibilityNeeded: Boolean(accessibilityNeeded),
  };

  const suggestions = await suggestTables(ctx);
  return NextResponse.json({ suggestions });
}
