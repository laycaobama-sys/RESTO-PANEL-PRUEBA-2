import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { listAutomations, createAutomation } from "@/lib/automations";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const automations = await listAutomations(user.organizationId);
  return NextResponse.json({ automations });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const auto = await createAutomation(user.organizationId, {
    name: body.name,
    description: body.description || null,
    trigger_type: body.trigger_type,
    trigger_config: body.trigger_config || {},
    conditions: body.conditions || [],
    actions: body.actions || [],
    is_active: body.is_active !== false,
  });
  if (!auto) return NextResponse.json({ error: "Error al crear automatización" }, { status: 500 });
  return NextResponse.json(auto, { status: 201 });
}
