import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { splitBill } from "@/lib/tpv";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json();
  const result = await splitBill(user.organizationId, body.orderId, body.splits);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
  return NextResponse.json(result);
}
