import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getTransactionHistory } from "@/lib/loyalty";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId");
  if (!customerId) return NextResponse.json({ error: "customerId obligatorio" }, { status: 400 });
  const transactions = await getTransactionHistory(user.organizationId, customerId);
  return NextResponse.json({ transactions });
}
