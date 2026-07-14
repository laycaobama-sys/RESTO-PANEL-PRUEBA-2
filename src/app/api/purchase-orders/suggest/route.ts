import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { suggestPurchaseOrders } from "@/lib/inventory";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const suggestions = await suggestPurchaseOrders(user.organizationId);
  return NextResponse.json({ suggestions });
}
