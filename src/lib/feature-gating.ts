// ============================================================
// RestoPanel · Feature Gating — checkSubscriptionPlan
// ============================================================
// Sprint 4 — Verifica el plan de suscripción de una organización
// y bloquea features premium si el plan no las incluye.
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

// Cache en memoria (TTL 60s) para evitar consultar la BD en cada request
const planCache = new Map<string, { plan: string; status: string; trial_ends_at: string | null; cachedAt: number }>();
const CACHE_TTL = 60 * 1000;

export interface SubscriptionPlan {
  plan: string;          // 'starter' | 'professional' | 'enterprise'
  status: string;        // 'trial' | 'active' | 'past_due' | 'canceled'
  trial_ends_at: string | null;
  days_left_in_trial: number | null;
  is_trialing: boolean;
  is_active: boolean;
}

// ─── Mapa de features por plan ───────────────────────────────
// Cada feature requiere un plan mínimo. Si la org está en trial,
// tiene acceso a todo durante 7 días.
export const FEATURE_PLAN_REQUIRED: Record<string, "starter" | "professional" | "enterprise"> = {
  // Starter (59€)
  reservations: "starter",
  tables: "starter",
  crm: "starter",
  menu: "starter",
  analytics_basic: "starter",
  email_notifications: "starter",

  // Professional (119€)
  whatsapp: "professional",
  automations: "professional",
  loyalty: "professional",
  waitlist: "professional",
  upsell: "professional",
  campaigns: "professional",
  ai_insights: "professional",
  reviews_ai: "professional",
  advanced_analytics: "professional",
  shifts: "professional",
  chat: "professional",

  // Enterprise (249€)
  api_access: "enterprise",
  webhooks: "enterprise",
  multi_restaurant: "enterprise",
  white_label: "enterprise",
  bi: "enterprise",
  account_manager: "enterprise",
};

const PLAN_HIERARCHY: Record<string, number> = {
  starter: 1,
  professional: 2,
  enterprise: 3,
};

// ─── Obtener plan actual de una organización ─────────────────
export async function getSubscriptionPlan(organizationId: string): Promise<SubscriptionPlan> {
  // Check cache
  const cached = planCache.get(organizationId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    const trialEnds = cached.trial_ends_at ? new Date(cached.trial_ends_at) : null;
    const daysLeft = trialEnds ? Math.ceil((trialEnds.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null;
    return {
      plan: cached.plan,
      status: cached.status,
      trial_ends_at: cached.trial_ends_at,
      days_left_in_trial: daysLeft,
      is_trialing: cached.status === "trial" && (daysLeft ?? 0) > 0,
      is_active: cached.status === "active" || (cached.status === "trial" && (daysLeft ?? 0) > 0),
    };
  }

  try {
    const { data } = await supabaseAdmin
      .from("organization_subscriptions")
      .select("status, trial_ends_at, subscription_plans!inner(name)")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!data) {
      // Sin suscripción → devolver starter trial
      return {
        plan: "starter",
        status: "trial",
        trial_ends_at: null,
        days_left_in_trial: null,
        is_trialing: false,
        is_active: false,
      };
    }

    const planName = (data.subscription_plans as any)?.name || "starter";
    const status = data.status;
    const trialEndsAt = data.trial_ends_at;

    // Cachear
    planCache.set(organizationId, {
      plan: planName,
      status,
      trial_ends_at: trialEndsAt,
      cachedAt: Date.now(),
    });

    const trialEnds = trialEndsAt ? new Date(trialEndsAt) : null;
    const daysLeft = trialEnds ? Math.ceil((trialEnds.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null;

    return {
      plan: planName,
      status,
      trial_ends_at: trialEndsAt,
      days_left_in_trial: daysLeft,
      is_trialing: status === "trial" && (daysLeft ?? 0) > 0,
      is_active: status === "active" || (status === "trial" && (daysLeft ?? 0) > 0),
    };
  } catch (e: any) {
    logger.warn("Failed to get subscription plan", "feature-gating", { error: e.message });
    // Fail-open en caso de error de BD (no bloquear a usuarios pagadores)
    return {
      plan: "professional",
      status: "active",
      trial_ends_at: null,
      days_left_in_trial: null,
      is_trialing: false,
      is_active: true,
    };
  }
}

// ─── Verificar si una feature está disponible ────────────────
export async function checkSubscriptionPlan(
  organizationId: string,
  requiredFeature: string
): Promise<{ allowed: boolean; plan: SubscriptionPlan; requiredPlan: string; reason?: string }> {
  const plan = await getSubscriptionPlan(organizationId);
  const requiredPlanName = FEATURE_PLAN_REQUIRED[requiredFeature] || "starter";
  const requiredLevel = PLAN_HIERARCHY[requiredPlanName] || 1;
  const currentLevel = PLAN_HIERARCHY[plan.plan] || 1;

  // Si está en trial activo, todo permitido
  if (plan.is_trialing) {
    return { allowed: true, plan, requiredPlan: requiredPlanName };
  }

  // Si está cancelado o past_due, solo starter
  if (plan.status === "canceled" || plan.status === "past_due") {
    if (requiredLevel > 1) {
      return {
        allowed: false,
        plan,
        requiredPlan: requiredPlanName,
        reason: `Tu suscripción está ${plan.status === "canceled" ? "cancelada" : "con pago pendiente"}. Renueva para acceder a esta función.`,
      };
    }
  }

  // Verificar nivel
  if (currentLevel < requiredLevel) {
    return {
      allowed: false,
      plan,
      requiredPlan: requiredPlanName,
      reason: `Esta función requiere el plan ${requiredPlanName === "professional" ? "Growth" : "Enterprise"}.`,
    };
  }

  return { allowed: true, plan, requiredPlan: requiredPlanName };
}

// ─── Invalidar cache ─────────────────────────────────────────
export function invalidatePlanCache(organizationId?: string) {
  if (organizationId) {
    planCache.delete(organizationId);
  } else {
    planCache.clear();
  }
}
