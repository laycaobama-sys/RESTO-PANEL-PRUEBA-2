import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getAllRoles } from "@/lib/rbac";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const roles = await getAllRoles(user.organizationId);
  return NextResponse.json({ roles });
}
