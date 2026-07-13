import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getCustomerInteractions, logCustomerInteraction } from "@/lib/crm";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const interactions = await getCustomerInteractions(user.organizationId, id);
  return NextResponse.json({ interactions });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  await logCustomerInteraction(user.organizationId, id, body.type || "note", {
    channel: body.channel,
    subject: body.subject,
    body: body.body,
    userId: user.id,
    metadata: body.metadata,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
