import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { seatFromWaitlist, cancelWaitlistEntry } from "@/lib/waitlist";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();

  if (body.action === "seat") {
    const ok = await seatFromWaitlist(user.organizationId, id, body.tableId);
    return NextResponse.json({ ok });
  }
  if (body.action === "cancel") {
    const ok = await cancelWaitlistEntry(user.organizationId, id);
    return NextResponse.json({ ok });
  }
  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
