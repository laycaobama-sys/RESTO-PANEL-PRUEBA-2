import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { redeemReward } from "@/lib/loyalty";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const { customerId, rewardId } = body;
  if (!customerId || !rewardId) {
    return NextResponse.json({ error: "customerId y rewardId obligatorios" }, { status: 400 });
  }
  const result = await redeemReward(user.organizationId, customerId, rewardId, user.id);
  if (!result.success) return NextResponse.json({ error: result.message }, { status: 400 });
  return NextResponse.json(result);
}
