import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getLostRevenue } from "@/lib/revenue";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days") || "30");
  const lost = await getLostRevenue(user.organizationId, days);
  return NextResponse.json(lost);
}
