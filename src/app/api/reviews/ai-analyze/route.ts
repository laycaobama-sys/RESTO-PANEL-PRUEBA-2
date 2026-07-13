import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { analyzeAllReviews } from "@/lib/reviews-ai";

export async function POST() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const count = await analyzeAllReviews(user.organizationId);
  return NextResponse.json({ analyzed: count });
}
