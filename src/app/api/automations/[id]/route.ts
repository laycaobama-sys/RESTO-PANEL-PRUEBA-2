import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { updateAutomation, deleteAutomation } from "@/lib/automations";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const ok = await updateAutomation(user.organizationId, id, body);
  if (!ok) return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const ok = await deleteAutomation(user.organizationId, id);
  if (!ok) return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
