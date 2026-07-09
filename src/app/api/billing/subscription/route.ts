import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { cancelSubscription, reactivateSubscription, getOrgPlan } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const plan = await getOrgPlan(user.organizationId);

  // Get usage
  const { count: userCount } = await supabaseAdmin
    .from("users").select("id", { count: "exact", head: true })
    .eq("organization_id", user.organizationId);
  
  const { count: tableCount } = await supabaseAdmin
    .from("tables").select("id", { count: "exact", head: true })
    .eq("organization_id", user.organizationId);

  const { data: invoices } = await supabaseAdmin
    .from("invoices").select("*")
    .eq("organization_id", user.organizationId)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: paymentMethods } = await supabaseAdmin
    .from("payment_methods").select("*")
    .eq("organization_id", user.organizationId)
    .order("is_default", { ascending: false });

  return NextResponse.json({
    plan,
    usage: {
      users: userCount || 0,
      tables: tableCount || 0,
    },
    invoices: invoices || [],
    paymentMethods: paymentMethods || [],
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { action } = body;

  const plan = await getOrgPlan(user.organizationId);
  if (!plan.stripeSubscriptionId) {
    return NextResponse.json({ error: "No hay suscripción activa en Stripe" }, { status: 400 });
  }

  if (action === "cancel") {
    await cancelSubscription(plan.stripeSubscriptionId);
    await supabaseAdmin
      .from("organization_subscriptions")
      .update({ cancel_at_period_end: true })
      .eq("organization_id", user.organizationId);

    await supabaseAdmin.from("subscription_history").insert({
      organization_id: user.organizationId,
      event_type: "subscription.cancel_scheduled",
    });

    return NextResponse.json({ ok: true, message: "Suscripción cancelada. Se mantendrá activa hasta el final del periodo." });
  }

  if (action === "reactivate") {
    await reactivateSubscription(plan.stripeSubscriptionId);
    await supabaseAdmin
      .from("organization_subscriptions")
      .update({ cancel_at_period_end: false, canceled_at: null })
      .eq("organization_id", user.organizationId);

    await supabaseAdmin.from("subscription_history").insert({
      organization_id: user.organizationId,
      event_type: "subscription.reactivated",
    });

    return NextResponse.json({ ok: true, message: "Suscripción reactivada correctamente." });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
