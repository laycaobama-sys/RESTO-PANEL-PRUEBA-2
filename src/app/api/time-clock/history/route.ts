import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getTimeClockHistory } from "@/lib/inventory";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || undefined;
  const days = Number(searchParams.get("days") || "30");
  const history = await getTimeClockHistory(user.organizationId, userId, days);
  return NextResponse.json({ history });
}
