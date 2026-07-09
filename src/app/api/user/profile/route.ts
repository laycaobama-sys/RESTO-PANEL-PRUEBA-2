import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getUserProfile, updateUserProfile } from "@/lib/session-management";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const profile = await getUserProfile(user.id);
  return NextResponse.json({ profile });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const ok = await updateUserProfile(user.id, {
    avatar_url: body.avatar_url,
    language: body.language,
    timezone: body.timezone,
    preferences: body.preferences,
  });
  if (ok) return NextResponse.json({ ok: true });
  return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
}
