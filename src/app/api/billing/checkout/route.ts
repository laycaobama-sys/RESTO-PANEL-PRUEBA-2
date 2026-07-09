import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getOrCreateCustomer, createCheckoutSession, PLANS, PlanName, getOrgPlan } from "@/lib/stripe";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // CRITICAL FIX: only ADMINs can change the org's subscription.
  // Previously, STAFF users could subscribe the org to Enterprise.
  if (user.role !== 'ADMIN' && !user.isSuperAdmin) {
    return NextResponse.json(
      { error: "Solo los administradores pueden cambiar el plan de suscripción." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { planName, billingCycle } = body;

  if (!PLANS[planName as PlanName]) {
    return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
  }

  // CRITICAL FIX: prevent duplicate subscriptions. If the org already
  // has an active Stripe subscription AND is trying to subscribe to a
  // DIFFERENT plan, we redirect them to the Stripe billing portal
  // where they can upgrade/downgrade properly (with proration).
  // If they're trying to subscribe to the SAME plan they already have,
  // we return a clear error.
  const currentPlan = await getOrgPlan(user.organizationId);
  if (currentPlan.stripeSubscriptionId && currentPlan.status === 'active') {
    if (currentPlan.planName === planName) {
      return NextResponse.json(
        { error: "Ya estás suscrito a este plan." },
        { status: 409 }
      );
    }
    // Different plan → use Stripe Portal for prorated upgrade/downgrade
    // instead of creating a second checkout session (which would result
    // in two concurrent subscriptions and double charges).
    const { createPortalSession } = await import("@/lib/stripe");
    const portal = await createPortalSession(
      currentPlan.stripeCustomerId || '',
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/?billing=portal`
    );
    if (portal?.url) {
      return NextResponse.json({
        url: portal.url,
        message: "Ya tienes una suscripción activa. Te redirigimos al portal de Stripe para cambiar de plan con prorrateo.",
      });
    }
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
