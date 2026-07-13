import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { findSimilarCustomers } from "@/lib/crm";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const similar = await findSimilarCustomers(user.organizationId, id, 5);
  return NextResponse.json({ similar });
}
