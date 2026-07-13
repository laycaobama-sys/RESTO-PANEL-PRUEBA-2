import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { predictDaily } from "@/lib/ai-center";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  const date = dateStr ? new Date(dateStr) : new Date();
  const prediction = await predictDaily(user.organizationId, date);
  return NextResponse.json(prediction);
}
