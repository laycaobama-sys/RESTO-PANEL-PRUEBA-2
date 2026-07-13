import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { listInsights, generateInsights } from "@/lib/ai-center";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const insights = await listInsights(user.organizationId, 30);
  return NextResponse.json({ insights });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const insights = await generateInsights(user.organizationId);
  return NextResponse.json({ generated: insights.length, insights });
}
