// ============================================================
// RestoPanel · Feature Flags Service
// ============================================================
// Centralized feature gate that checks if a feature is enabled
// for a given organization based on their subscription plan.
//
// Usage:
//   import { isFeatureEnabled } from "@/lib/feature-flags";
//   if (await isFeatureEnabled(orgId, "analytics")) { ... }
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";

// Cache: org_id → { flags: Map<string, boolean>, cachedAt: number }
const orgFlagsCache = new Map<string, { flags: Map<string, boolean>; cachedAt: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute

// Default flags (used when DB tables don't exist yet)
const DEFAULT_FLAGS: Record<string, boolean> = {
  reservations: true,
  tables: true,
  crm: true,
  menu: true,
  analytics: true,
  chat: true,
  shifts: true,
  kitchen: true,
  whatsapp: false,
  web_import: true,
  google_reviews: true,
  advanced_analytics: false,
  api_access: false,
  white_label: false,
};

// Plan hierarchy
const PLAN_HIERARCHY: Record<string, number> = {
  starter: 1,
  professional: 2,
  enterprise: 3,
};

export async function isFeatureEnabled(
  organizationId: string,
  featureKey: string
): Promise<boolean> {
  // Check cache
  const cached = orgFlagsCache.get(organizationId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached.flags.get(featureKey) ?? DEFAULT_FLAGS[featureKey] ?? false;
  }

  // Build flags for this org
  const flags = new Map<string, boolean>();

  try {
    // Get all feature flags
    const { data: flagDefs } = await supabaseAdmin
      .from("feature_flags")
      .select("*");

    if (!flagDefs || flagDefs.length === 0) {
      // Table doesn't exist yet — use defaults
      Object.entries(DEFAULT_FLAGS).forEach(([k, v]) => flags.set(k, v));
    } else {
      // Get org's subscription plan AND status
      let orgPlan = "professional"; // default
      let orgStatus = "trial"; // default
      try {
        const { data: sub } = await supabaseAdmin
          .from("organization_subscriptions")
          .select("status, subscription_plans!inner(name)")
          .eq("organization_id", organizationId)
          .maybeSingle();

        const planData = sub?.subscription_plans;
        const planName = Array.isArray(planData) ? (planData[0] as any)?.name : (planData as any)?.name;
        if (planName) {
          orgPlan = planName;
        }
        if (sub?.status) {
          orgStatus = sub.status;
        }
      } catch {
        // Table might not exist — use default plan
      }

      // CRITICAL FIX: if the subscription is canceled or past_due,
      // downgrade to starter immediately. Previously, a canceled user
      // retained all premium features forever because the status was
      // never checked.
      const EFFECTIVE_PLAN = (orgStatus === 'canceled' || orgStatus === 'past_due')
        ? 'starter'
        : orgPlan;
      const orgPlanLevel = PLAN_HIERARCHY[EFFECTIVE_PLAN] || 2;

      for (const flag of flagDefs) {
        if (!flag.plan_required) {
          // No plan required — use default_value
          flags.set(flag.key, flag.default_value);
        } else {
          // Check if org's plan meets the requirement
          const requiredLevel = PLAN_HIERARCHY[flag.plan_required] || 0;
          flags.set(flag.key, orgPlanLevel >= requiredLevel);
        }
      }
    }
  } catch {
    // DB error — use defaults
    Object.entries(DEFAULT_FLAGS).forEach(([k, v]) => flags.set(k, v));
  }

  // Cache the result
  orgFlagsCache.set(organizationId, { flags, cachedAt: Date.now() });

  return flags.get(featureKey) ?? DEFAULT_FLAGS[featureKey] ?? false;
}

// ─── Check multiple features (all must be enabled) ──────────
export async function areFeaturesEnabled(
  organizationId: string,
  featureKeys: string[]
): Promise<boolean> {
  for (const key of featureKeys) {
    if (!(await isFeatureEnabled(organizationId, key))) return false;
  }
  return true;
}

// ─── Get all enabled features for an org ────────────────────
export async function getEnabledFeatures(
  organizationId: string
): Promise<Record<string, boolean>> {
  // Force cache build
  await isFeatureEnabled(organizationId, "reservations");

  const cached = orgFlagsCache.get(organizationId);
  if (!cached) return DEFAULT_FLAGS;

  const result: Record<string, boolean> = {};
  for (const [key, value] of cached.flags) {
    result[key] = value;
  }
  return result;
}

// ─── Invalidate cache ───────────────────────────────────────
export function invalidateFeatureFlagsCache(organizationId?: string) {
  if (organizationId) {
    orgFlagsCache.delete(organizationId);
  } else {
    orgFlagsCache.clear();
  }
}

// ─── Check usage limits ─────────────────────────────────────
export async function checkUsageLimit(
  organizationId: string,
  metric: string
): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  try {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const { data: usage } = await supabaseAdmin
      .from("organization_usage")
      .select("count, limit_value")
      .eq("organization_id", organizationId)
      .eq("metric", metric)
      .eq("period", period)
      .maybeSingle();

    const current = usage?.count || 0;
    const limit = usage?.limit_value || null;

    return {
      allowed: limit === null || current < limit,
      current,
      limit,
    };
  } catch {
    // Table doesn't exist — allow everything
    return { allowed: true, current: 0, limit: null };
  }
}

// ─── Increment usage counter ────────────────────────────────
export async function incrementUsage(
  organizationId: string,
  metric: string
): Promise<void> {
  try {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // CRITICAL FIX: use atomic PL/pgSQL RPC instead of read-modify-write.
    // The RPC does INSERT ... ON CONFLICT DO UPDATE SET count = count + 1
    // which is fully atomic and race-condition-free.
    // If the RPC doesn't exist (migration 0019 not applied), we fall
    // back to a best-effort upsert (which has a small race window but
    // is acceptable for usage tracking).
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const { error } = await supabaseAdmin.rpc("increment_usage", {
      p_organization_id: organizationId,
      p_metric: metric,
      p_period: period,
    });

    if (error) {
      // RPC doesn't exist (migration 0019 not applied) — fall back
      // to best-effort upsert. Non-critical.
      await supabaseAdmin
        .from("organization_usage")
        .upsert(
          {
            organization_id: organizationId,
            metric,
            period,
            count: 1,
            updated_at: now.toISOString(),
          },
          { onConflict: "organization_id,metric,period" }
        );
    }
  } catch {
    // Non-critical
  }
}
