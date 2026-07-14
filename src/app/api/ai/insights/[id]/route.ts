import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { markInsightRead, dismissInsight } from "@/lib/ai-center";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  if (body.action === "read") {
    await markInsightRead(user.organizationId, id);
  } else if (body.action === "dismiss") {
    await dismissInsight(user.organizationId, id);
  }
  return NextResponse.json({ ok: true });
}
