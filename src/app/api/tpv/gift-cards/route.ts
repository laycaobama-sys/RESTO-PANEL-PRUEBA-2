import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createGiftCard } from "@/lib/tpv";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json();
  const result = await createGiftCard(user.organizationId, Number(body.amount), body.customerId);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
