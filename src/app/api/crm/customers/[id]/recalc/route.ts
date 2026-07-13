import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { recalcCustomer } from "@/lib/crm";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  await recalcCustomer(id);
  return NextResponse.json({ ok: true, message: "Métricas y segmento recalculados" });
}
