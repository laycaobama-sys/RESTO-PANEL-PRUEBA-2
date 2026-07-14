import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getKDSItems, getKDSStats, listStations, createStation } from "@/lib/kds";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const stationId = searchParams.get("stationId") || undefined;
  const [items, stats, stations] = await Promise.all([
    getKDSItems(user.organizationId, stationId),
    getKDSStats(user.organizationId),
    listStations(user.organizationId),
  ]);
  return NextResponse.json({ items, stats, stations });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (user.role !== "ADMIN" && !user.isSuperAdmin))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json();
  const station = await createStation(user.organizationId, body.name, body.type, body.color);
  if (!station) return NextResponse.json({ error: "Error al crear estación" }, { status: 500 });
  return NextResponse.json(station, { status: 201 });
}
