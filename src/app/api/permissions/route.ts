import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getAllPermissions, getPermissionsForRole } from "@/lib/rbac";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const roleId = searchParams.get("roleId");

  if (roleId) {
    const permissions = await getPermissionsForRole(roleId);
    return NextResponse.json({ permissions });
  }

  const all = await getAllPermissions();
  return NextResponse.json({ permissions: all });
}
