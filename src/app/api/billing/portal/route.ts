import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createPortalSession, getOrgPlan } from "@/lib/stripe";

export async function POST() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const plan = await getOrgPlan(user.organizationId);
  if (!plan.stripeCustomerId) {
    return NextResponse.json({ error: "No hay método de pago configurado" }, { status: 400 });
  }

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const result = await createPortalSession(plan.stripeCustomerId, `${baseUrl}/`);

  if (!result) {
    return NextResponse.json({ error: "Stripe no configurado" }, { status: 503 });
  }

  return NextResponse.json({ url: result.url });
}
