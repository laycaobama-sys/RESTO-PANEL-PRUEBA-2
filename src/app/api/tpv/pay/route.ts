import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { processPayment } from "@/lib/tpv";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json();
  const result = await processPayment({
    organizationId: user.organizationId,
    orderId: body.orderId,
    payments: body.payments,
    invoiceType: body.invoiceType || "TICKET",
    userId: user.id,
  });
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
  return NextResponse.json(result);
}
