import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getOrCreateCustomer, createCheckoutSession, PLANS, PlanName } from "@/lib/stripe";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { planName, billingCycle } = body;

  if (!PLANS[planName as PlanName]) {
    return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
  }

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const customerId = await getOrCreateCustomer(user.organizationId, user.email, user.name || user.organizationName);

  if (!customerId) {
    return NextResponse.json({ error: "Stripe no configurado. Contacta con soporte." }, { status: 503 });
  }

  const result = await createCheckoutSession({
    organizationId: user.organizationId,
    planName: planName as PlanName,
    billingCycle: billingCycle || "monthly",
    customerId,
    successUrl: `${baseUrl}/?billing=success`,
    cancelUrl: `${baseUrl}/?billing=cancelled`,
  });

  if (!result) {
    return NextResponse.json({ error: "No se pudo crear la sesión de checkout" }, { status: 500 });
  }

  return NextResponse.json({ url: result.url });
}
