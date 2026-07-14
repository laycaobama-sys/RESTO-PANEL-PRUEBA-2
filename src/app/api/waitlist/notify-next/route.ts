import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { notifyNext } from "@/lib/waitlist";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const { tableId, tableCapacity } = body;
  if (!tableId) return NextResponse.json({ error: "tableId obligatorio" }, { status: 400 });
  const next = await notifyNext(user.organizationId, tableId, Number(tableCapacity) || 4);
  if (!next) return NextResponse.json({ message: "No hay nadie en la lista que quepa en esta mesa" }, { status: 404 });
  return NextResponse.json(next);
}
