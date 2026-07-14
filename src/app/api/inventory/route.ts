import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { listInventory, createInventoryItem } from "@/lib/inventory";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const lowStock = searchParams.get("lowStock") === "true";
  const items = await listInventory(user.organizationId, lowStock);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json();
  const item = await createInventoryItem(user.organizationId, body);
  if (!item) return NextResponse.json({ error: "Error al crear item" }, { status: 500 });
  return NextResponse.json(item, { status: 201 });
}
