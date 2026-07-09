// ============================================================
// RestoPanel · Stripe Service
// ============================================================
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";

// Lazy init — don't crash if key not set (dev mode)
let _stripe: Stripe | null = null;
function getStripe(): Stripe | null {
  if (!STRIPE_SECRET_KEY) return null;
  if (!_stripe) _stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" as any });
  return _stripe;
}

export const PLANS = {
  starter: { name: "starter", label: "Inicio", monthly: 59, yearly: 590, maxRestaurants: 1, maxUsers: 3 },
  professional: { name: "professional", label: "Premium", monthly: 119, yearly: 1190, maxRestaurants: 3, maxUsers: 10 },
  enterprise: { name: "enterprise", label: "Empresarial", monthly: 249, yearly: 2490, maxRestaurants: 5, maxUsers: null },
} as const;

export type PlanName = keyof typeof PLANS;

// ─── Create or get Stripe customer ───────────────────────────
export async function getOrCreateCustomer(organizationId: string, email: string, name: string): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  // Check if org already has a stripe_customer_id
  const { data: sub } = await supabaseAdmin
    .from("organization_subscriptions")
    .select("stripe_customer_id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (sub?.stripe_customer_id) return sub.stripe_customer_id;

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { organization_id: organizationId },
  });

  // Save customer ID
  await supabaseAdmin
    .from("organization_subscriptions")
    .upsert({
      organization_id: organizationId,
      stripe_customer_id: customer.id,
      plan_id: (await supabaseAdmin.from("subscription_plans").select("id").eq("name", "starter").single()).data?.id,
      billing_cycle: "monthly",
      status: "trial",
    });

  return customer.id;
}

// ─── Create checkout session ─────────────────────────────────
export async function createCheckoutSession(opts: {
  organizationId: string;
  planName: PlanName;
  billingCycle: "monthly" | "yearly";
  customerId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const plan = PLANS[opts.planName];
  if (!plan) return null;

  // Get or create product/price in Stripe
  const priceId = await ensureStripePrice(opts.planName, opts.billingCycle);
  if (!priceId) throw new Error('Failed to create Stripe price');

  const session = await stripe.checkout.sessions.create({
    customer: opts.customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: {
      organization_id: opts.organizationId,
      plan_name: opts.planName,
      billing_cycle: opts.billingCycle,
    },
    subscription_data: {
      metadata: {
        organization_id: opts.organizationId,
        plan_name: opts.planName,
        billing_cycle: opts.billingCycle,
      },
    },
  });

  return { url: session.url || "" };
}

// ─── Ensure Stripe product & price exist ─────────────────────
async function ensureStripePrice(planName: PlanName, cycle: "monthly" | "yearly"): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured");

  const plan = PLANS[planName];
  const productName = `RestoPanel ${plan.label}`;
  const amount = cycle === "monthly" ? plan.monthly : plan.yearly;
  const interval = cycle === "monthly" ? "month" : "year";

  // Search for existing product
  const products = await stripe.products.list({ limit: 100 });
  let product = products.data.find((p) => p.name === productName);

  if (!product) {
    product = await stripe.products.create({
      name: productName,
      metadata: { plan_name: planName },
    });
  }

  // Search for existing price
  const prices = await stripe.prices.list({ product: product.id, limit: 10 });
  const existingPrice = prices.data.find(
    (p) => p.unit_amount === amount * 100 && p.recurring?.interval === interval
  );

  if (existingPrice) return existingPrice.id;

  // Create new price
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amount * 100,
    currency: "eur",
    recurring: { interval },
    metadata: { plan_name: planName, billing_cycle: cycle },
  });

  return price.id;
}

// ─── Create billing portal session ───────────────────────────
export async function createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return { url: session.url || "" };
}

// ─── Cancel subscription at period end ───────────────────────
export async function cancelSubscription(stripeSubscriptionId: string): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe) return false;

  await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  return true;
}

// ─── Reactivate subscription ─────────────────────────────────
export async function reactivateSubscription(stripeSubscriptionId: string): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe) return false;

  await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  return true;
}

// ─── Verify webhook signature ────────────────────────────────
export function verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event | null {
  const stripe = getStripe();
  if (!stripe) return null;

  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) return null;

  try {
    return stripe.webhooks.constructEvent(payload, signature, endpointSecret);
  } catch (e: any) {
    logger.error("Stripe webhook signature verification failed", "stripe", { error: e.message });
    return null;
  }
}

// ─── Get org's current plan ──────────────────────────────────
export async function getOrgPlan(organizationId: string): Promise<{ planName: string; planLabel: string; billingCycle: string; status: string; maxRestaurants: number; maxUsers: number | null; maxTables: number | null; maxReservations: number | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; stripeCustomerId: string | null; stripeSubscriptionId: string | null }> {
  const { data } = await supabaseAdmin
    .from("organization_subscriptions")
    .select(`
      status,
      billing_cycle,
      current_period_end,
      cancel_at_period_end,
      stripe_customer_id,
      stripe_subscription_id,
      subscription_plans!inner(name, label, max_tables, max_users, max_reservations, features)
    `)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!data) {
    return {
      planName: "starter",
      planLabel: "Inicio",
      billingCycle: "monthly",
      status: "trial",
      maxRestaurants: 1,
      maxUsers: 3,
      maxTables: 15,
      maxReservations: 500,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    };
  }

  const plan = (data.subscription_plans as any)?.[0] || data.subscription_plans;
  const features = plan?.features || {};
  const maxRestaurants = features.max_restaurants || 1;

  return {
    planName: plan?.name || "starter",
    planLabel: plan?.label || "Inicio",
    billingCycle: data.billing_cycle,
    status: data.status,
    maxRestaurants,
    maxUsers: plan?.max_users || 3,
    maxTables: plan?.max_tables || 15,
    maxReservations: plan?.max_reservations || 500,
    currentPeriodEnd: data.current_period_end,
    cancelAtPeriodEnd: data.cancel_at_period_end || false,
    stripeCustomerId: data.stripe_customer_id,
    stripeSubscriptionId: data.stripe_subscription_id,
  };
}

// ─── Check if org can add more ───────────────────────────────
export async function checkLimit(organizationId: string, metric: "restaurants" | "users" | "tables" | "reservations"): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  const plan = await getOrgPlan(organizationId);
  
  let current = 0;
  let limit: number | null = null;

  switch (metric) {
    case "restaurants": {
      const { count } = await supabaseAdmin.from("organizations").select("id", { count: "exact", head: true });
      current = count || 0;
      limit = plan.maxRestaurants;
      break;
    }
    case "users": {
      const { count } = await supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
      current = count || 0;
      limit = plan.maxUsers;
      break;
    }
    case "tables": {
      const { count } = await supabaseAdmin.from("tables").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
      current = count || 0;
      limit = plan.maxTables;
      break;
    }
    case "reservations": {
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const { count } = await supabaseAdmin
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", `${period}-01T00:00:00Z`);
      current = count || 0;
      limit = plan.maxReservations;
      break;
    }
  }

  return { allowed: limit === null || current < limit, current, limit };
}
