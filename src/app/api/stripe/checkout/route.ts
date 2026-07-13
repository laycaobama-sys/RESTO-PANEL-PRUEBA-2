// ============================================================
// RestoPanel · Stripe Checkout with 7-day trial
// ============================================================
// Sprint 4 — Monetización y Suscripciones
// Crea una sesión de Stripe Checkout con subscription_data:
// { trial_period_days: 7 } para capturar la tarjeta pero NO
// cobrar hasta pasados 7 días.
// ============================================================

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getOrCreateCustomer, createCheckoutSession, PLANS, PlanName, getOrgPlan } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Solo ADMINs pueden cambiar el plan
  if (user.role !== "ADMIN" && !user.isSuperAdmin) {
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

  // Verificar si ya tiene suscripción activa
  const currentPlan = await getOrgPlan(user.organizationId);
  if (currentPlan.stripeSubscriptionId && currentPlan.status === "active") {
    if (currentPlan.planName === planName) {
      return NextResponse.json(
        { error: "Ya estás suscrito a este plan." },
        { status: 409 }
      );
    }
    // Diferente plan → redirigir a Stripe Portal para prorrateo
    const { createPortalSession } = await import("@/lib/stripe");
    const portal = await createPortalSession(
      currentPlan.stripeCustomerId || "",
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/?billing=portal`
    );
    if (portal?.url) {
      return NextResponse.json({
        url: portal.url,
        message: "Ya tienes una suscripción activa. Te redirigimos al portal de Stripe para cambiar de plan.",
      });
    }
  }

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const customerId = await getOrCreateCustomer(user.organizationId, user.email, user.name || user.organizationName);

  if (!customerId) {
    return NextResponse.json({ error: "Stripe no configurado. Contacta con soporte." }, { status: 503 });
  }

  // ─── Crear sesión de Checkout con trial de 7 días ─────────
  // CRÍTICO: subscription_data.trial_period_days = 7 captura la
  // tarjeta pero NO cobra hasta pasados 7 días. Esto cumple el
  // requisito de "prueba gratis de 7 días".
  try {
    const stripe = (await import("@/lib/stripe")).getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Stripe no configurado" }, { status: 503 });
    }

    // Obtener o crear el price en Stripe
    const { ensureStripePrice } = await import("@/lib/stripe");
    const priceId = await ensureStripePrice(planName as PlanName, billingCycle || "monthly");
    if (!priceId) throw new Error("Failed to create Stripe price");

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/?billing=success`,
      cancel_url: `${baseUrl}/?billing=cancelled`,
      metadata: {
        organization_id: user.organizationId,
        plan_name: planName,
        billing_cycle: billingCycle || "monthly",
      },
      subscription_data: {
        trial_period_days: 7,  // ← 7 días de prueba gratuita
        metadata: {
          organization_id: user.organizationId,
          plan_name: planName,
          billing_cycle: billingCycle || "monthly",
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      customer_update: {
        address: "auto",
        name: "auto",
      },
    });

    // Registrar en organization_subscriptions que hay un trial en curso
    const { data: starterPlan } = await supabaseAdmin
      .from("subscription_plans")
      .select("id")
      .eq("name", planName)
      .single();

    if (starterPlan) {
      await supabaseAdmin
        .from("organization_subscriptions")
        .upsert({
          organization_id: user.organizationId,
          stripe_customer_id: customerId,
          plan_id: starterPlan.id,
          billing_cycle: billingCycle || "monthly",
          status: "trial",
          trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: "organization_id" });
    }

    logger.info("Checkout session created with 7-day trial", "stripe", {
      organizationId: user.organizationId,
      planName,
      sessionId: session.id,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    logger.error("Checkout creation failed", "stripe", { error: e.message });
    return NextResponse.json({ error: "No se pudo crear la sesión de checkout: " + e.message }, { status: 500 });
  }
}
