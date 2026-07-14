import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { clockIn, clockOut } from "@/lib/inventory";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json();
  const fn = body.type === "CLOCK_OUT" ? clockOut : clockIn;
  const entry = await fn(user.organizationId, user.id, {
    latitude: body.latitude,
    longitude: body.longitude,
    deviceInfo: body.deviceInfo,
    ipAddress: body.ipAddress,
  });
  if (!entry) return NextResponse.json({ error: "Error al registrar fichaje" }, { status: 500 });
  return NextResponse.json(entry, { status: 201 });
}
