import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getRecentExecutions } from "@/lib/automations";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const executions = await getRecentExecutions(user.organizationId, 30);
  return NextResponse.json({ executions });
}
