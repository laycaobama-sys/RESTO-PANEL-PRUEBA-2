import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { suggestPurchaseOrders, createPurchaseOrder } from "@/lib/inventory";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const suggestions = await suggestPurchaseOrders(user.organizationId);
  return NextResponse.json({ suggestions });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json();
  const po = await createPurchaseOrder(user.organizationId, {
    supplierId: body.supplierId,
    lines: body.lines,
    aiRecommended: body.aiRecommended,
    aiReason: body.aiReason,
    userId: user.id,
  });
  if (!po) return NextResponse.json({ error: "Error al crear pedido" }, { status: 500 });
  return NextResponse.json(po, { status: 201 });
}
