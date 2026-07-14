import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { receivePurchaseOrder } from "@/lib/inventory";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const result = await receivePurchaseOrder(user.organizationId, id, body.receptions);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
  return NextResponse.json(result);
}
