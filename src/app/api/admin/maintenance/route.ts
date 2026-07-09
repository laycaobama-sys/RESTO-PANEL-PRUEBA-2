import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { isMaintenanceMode, setMaintenanceMode, getMaintenanceMessage } from "@/lib/system-settings";

export async function GET() {
  const enabled = await isMaintenanceMode();
  const message = await getMaintenanceMessage();
  return NextResponse.json({ enabled, message });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  await setMaintenanceMode(!!body.enabled, body.message, user.id);
  return NextResponse.json({ ok: true, enabled: !!body.enabled });
}
