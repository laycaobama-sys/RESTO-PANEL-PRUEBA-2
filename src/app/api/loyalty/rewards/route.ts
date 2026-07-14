import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { listRewards, createReward } from "@/lib/loyalty";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const rewards = await listRewards(user.organizationId);
  return NextResponse.json({ rewards });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const reward = await createReward(user.organizationId, {
    name: body.name,
    description: body.description || null,
    type: body.type,
    points_cost: Number(body.points_cost),
    value_eur: body.value_eur || null,
    discount_type: body.discount_type || null,
    discount_value: body.discount_value || null,
    menu_item_id: body.menu_item_id || null,
    image_url: body.image_url || null,
    is_active: body.is_active !== false,
    max_redemptions: body.max_redemptions || null,
  });
  if (!reward) return NextResponse.json({ error: "Error al crear recompensa" }, { status: 500 });
  return NextResponse.json(reward, { status: 201 });
}
