import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { updateKDSStatus, setPriority } from "@/lib/kds";

export async function PATCH(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { itemId } = await params;
  const body = await req.json();
  if (body.status) {
    await updateKDSStatus(user.organizationId, itemId, body.status);
  }
  if (body.priority !== undefined) {
    await setPriority(user.organizationId, itemId, Number(body.priority));
  }
  return NextResponse.json({ ok: true });
}
