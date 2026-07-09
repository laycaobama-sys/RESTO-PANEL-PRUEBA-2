import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getActiveSessions, revokeAllUserSessions, revokeSessionByJtiAndUser } from "@/lib/session-management";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const sessions = await getActiveSessions(user.id);
  return NextResponse.json({ sessions });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const jti = searchParams.get("jti");
  const all = searchParams.get("all") === "true";

  if (all) {
    await revokeAllUserSessions(user.id, (user as any)?.jti || '');
    return NextResponse.json({ ok: true, message: "Todas las sesiones cerradas (excepto la actual)" });
  }

  if (jti) {
    // CRITICAL FIX: filter by BOTH jti AND user_id — otherwise any
    // authenticated user can revoke any other user's session by
    // passing that user's jti (IDOR).
    await revokeSessionByJtiAndUser(jti, user.id);
    return NextResponse.json({ ok: true, message: "Sesión cerrada" });
  }

  return NextResponse.json({ error: "Especifica jti o all=true" }, { status: 400 });
}
