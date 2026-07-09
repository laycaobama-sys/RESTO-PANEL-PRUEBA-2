import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getAllSettings, setSetting } from "@/lib/system-settings";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const settings = await getAllSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const { key, value } = body;
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  const ok = await setSetting(key, value, user.id);
  return NextResponse.json({ ok });
}
