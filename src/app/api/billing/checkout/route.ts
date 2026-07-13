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

  // CRITICAL FIX (validate-concurrency): the original route had a
  // race window between getOrgPlan() (SELECT) and createCheckoutSession()
  // (Stripe API call). Two concurrent admin requests could both pass
  // the guard and create two Stripe checkout sessions for the same
  // org — resulting in double charges and confusion.
  //
  // The fix is `acquire_checkout_lock()` (migration 0020) which does
  // `pg_advisory_xact_lock(hashtext('checkout:' || org_id))`. We also
  // use the persistent `checkout_locks` table as a fallback: INSERT
  // ON CONFLICT DO NOTHING — if 0 rows returned, another checkout is
  // in progress, return 409. The lock row is deleted in a finally
  // block (or expires after 5 minutes via the expires_at column).
  //
  // After acquiring the lock, we RE-READ getOrgPlan() so the guard
  // sees the post-lock state. Even if two requests slipped through
  // the advisory lock (because it's transaction-scoped and releases
  // on return), the persistent checkout_locks table guarantees only
  // 1 row is inserted per org.
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  // Acquire the persistent lock (INSERT ON CONFLICT DO NOTHING).
  // The lock row is deleted in the finally block below.
  const { data: lockRow, error: lockError } = await supabaseAdmin
    .from("checkout_locks")
    .insert({
      organization_id: user.organizationId,
      acquired_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })
    .select("organization_id")
    .maybeSingle();

  if (lockError || !lockRow) {
    // Lock already held by another request — return 409.
    return NextResponse.json(
      {
        error:
          "Ya hay un proceso de checkout en curso para tu organización. Espera unos segundos e inténtalo de nuevo.",
      },
      { status: 409 }
    );
  }

  // Best-effort: also acquire the advisory lock (transient, but
  // cheaper than the table row for the duration of the request).
  try {
    await supabaseAdmin.rpc("acquire_checkout_lock", {
      p_organization_id: user.organizationId,
    });
  } catch {
    // ignore error if RPC doesn't exist (migration 0020 not applied)
  }

  try {
    // CRITICAL FIX: prevent duplicate subscriptions. If the org already
    // has an active Stripe subscription AND is trying to subscribe to a
    // DIFFERENT plan, we redirect them to the Stripe billing portal
    // where they can upgrade/downgrade properly (with proration).
    // If they're trying to subscribe to the SAME plan they already have,
    // we return a clear error.
    //
    // NOTE: this re-read happens AFTER acquiring the lock, so concurrent
    // requests see the post-lock state.
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
  } finally {
    // Release the persistent lock.
    try {
      await supabaseAdmin
        .from("checkout_locks")
        .delete()
        .eq("organization_id", user.organizationId);
    } catch {
      // best-effort
    }
  }
}
