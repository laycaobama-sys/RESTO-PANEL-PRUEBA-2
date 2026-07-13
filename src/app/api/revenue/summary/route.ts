import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getRevenueSummary } from "@/lib/revenue";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const summary = await getRevenueSummary(user.organizationId);
  return NextResponse.json(summary);
}
