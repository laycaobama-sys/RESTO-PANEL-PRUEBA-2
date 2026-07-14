import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getLoyaltyConfig, updateLoyaltyConfig } from "@/lib/loyalty";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const config = await getLoyaltyConfig(user.organizationId);
  return NextResponse.json(config);
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const ok = await updateLoyaltyConfig(user.organizationId, body);
  if (!ok) return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
