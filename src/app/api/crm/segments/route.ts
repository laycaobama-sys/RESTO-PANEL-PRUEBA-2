import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getSegmentStats } from "@/lib/crm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const stats = await getSegmentStats(user.organizationId);
  return NextResponse.json({ segments: stats });
}
