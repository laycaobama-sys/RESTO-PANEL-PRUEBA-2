import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { listSuppliers, createSupplier } from "@/lib/inventory";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const suppliers = await listSuppliers(user.organizationId);
  return NextResponse.json({ suppliers });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json();
  const supplier = await createSupplier(user.organizationId, body);
  if (!supplier) return NextResponse.json({ error: "Error al crear proveedor" }, { status: 500 });
  return NextResponse.json(supplier, { status: 201 });
}
