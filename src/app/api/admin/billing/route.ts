import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get all org subscriptions with plan and org info.
  // We bound the result with .limit(500) — super admin billing dashboard
  // doesn't need more than the most recent 500 subscriptions, and without
  // a limit this query would grow unbounded as the SaaS scales.
  const { data: subs } = await supabaseAdmin
    .from("organization_subscriptions")
    .select(`
      status,
      billing_cycle,
      current_period_end,
      cancel_at_period_end,
      organizations!inner(id, name),
      subscription_plans!inner(name, label, price_monthly, price_yearly)
    `)
    .order("created_at", { ascending: false })
    .limit(500);

  const organizations = (subs || []).map((s: any) => {
    const plan = Array.isArray(s.subscription_plans) ? s.subscription_plans[0] : s.subscription_plans;
    const org = Array.isArray(s.organizations) ? s.organizations[0] : s.organizations;
    const price = s.billing_cycle === "yearly" ? plan?.price_yearly : plan?.price_monthly;
    return {
      id: org?.id,
      name: org?.name,
      plan_label: plan?.label,
      plan_name: plan?.name,
      billing_cycle: s.billing_cycle,
      status: s.status,
      current_period_end: s.current_period_end,
      mrr: s.status === "active" ? price : 0,
    };
  });

  // Calculate stats
  const active = organizations.filter(o => o.status === "active");
  const mrr = active.reduce((sum, o) => sum + (o.mrr || 0), 0);
  const stats = {
    mrr: mrr.toFixed(2),
    arr: (mrr * 12).toFixed(2),
    active: active.length,
    canceled: organizations.filter(o => o.status === "canceled").length,
    pastDue: organizations.filter(o => o.status === "past_due").length,
    totalRevenue: mrr * 12,
  };

  return NextResponse.json({ organizations, stats });
}
