// ============================================================
// RestoPanel · Revenue Management
// ============================================================
// Calcula ingresos realizados, previstos, perdidos, recuperados,
// y ROI por canal (campañas, reservas, lista espera, reviews,
// WhatsApp, fidelización).
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface RevenueSummary {
  today: {
    realized: number;
    pending: number;
    lost: number;
    recovered: number;
    upsell: number;
    covers: number;
    avg_ticket: number;
  };
  week: {
    realized: number;
    pending: number;
    lost: number;
    recovered: number;
    upsell: number;
    covers: number;
  };
  month: {
    realized: number;
    pending: number;
    lost: number;
    recovered: number;
    upsell: number;
    covers: number;
  };
  year: {
    realized: number;
    pending: number;
    lost: number;
    recovered: number;
    upsell: number;
    covers: number;
  };
}

export interface ROIByChannel {
  campaigns: { cost: number; revenue: number; roi: number };
  reservations: { cost: number; revenue: number; roi: number };
  waitlist: { cost: number; revenue: number; roi: number };
  reviews: { cost: number; revenue: number; roi: number };
  whatsapp: { cost: number; revenue: number; roi: number };
  loyalty: { cost: number; revenue: number; roi: number };
}

// ─── Obtener resumen de revenue ──────────────────────────────
export async function getRevenueSummary(organizationId: string): Promise<RevenueSummary> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [today, week, month, year] = await Promise.all([
    getRevenueForPeriod(organizationId, todayStart, now),
    getRevenueForPeriod(organizationId, weekStart, now),
    getRevenueForPeriod(organizationId, monthStart, now),
    getRevenueForPeriod(organizationId, yearStart, now),
  ]);

  return { today, week, month, year };
}

async function getRevenueForPeriod(orgId: string, start: Date, end: Date): Promise<any> {
  const { data: reservations } = await supabaseAdmin
    .from("reservations")
    .select("status, estimated_revenue, party_size")
    .eq("organization_id", orgId)
    .gte("date", start.toISOString())
    .lt("date", end.toISOString());

  const { data: upsells } = await supabaseAdmin
    .from("reservation_upsells")
    .select("total_price, status")
    .eq("organization_id", orgId)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  const realized = (reservations || [])
    .filter(r => r.status === "COMPLETED")
    .reduce((s, r) => s + Number(r.estimated_revenue || 0), 0);
  const pending = (reservations || [])
    .filter(r => ["CONFIRMED", "PENDING", "SEATED"].includes(r.status))
    .reduce((s, r) => s + Number(r.estimated_revenue || 0), 0);
  const lost = (reservations || [])
    .filter(r => ["NO_SHOW", "CANCELLED"].includes(r.status))
    .reduce((s, r) => s + Number(r.estimated_revenue || 0), 0);
  const covers = (reservations || [])
    .filter(r => r.status === "COMPLETED")
    .reduce((s, r) => s + r.party_size, 0);
  const upsell = (upsells || [])
    .filter(u => u.status !== "CANCELLED")
    .reduce((s, u) => s + Number(u.total_price || 0), 0);

  return {
    realized: Math.round(realized * 100) / 100,
    pending: Math.round(pending * 100) / 100,
    lost: Math.round(lost * 100) / 100,
    recovered: 0, // TODO: calcular desde waitlist → seated
    upsell: Math.round(upsell * 100) / 100,
    covers,
    avg_ticket: covers > 0 ? Math.round((realized / covers) * 100) / 100 : 0,
  };
}

// ─── Calcular ROI por canal ──────────────────────────────────
export async function getROIByChannel(organizationId: string): Promise<ROIByChannel> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // ROI campañas
  const { data: campaigns } = await supabaseAdmin
    .from("campaigns")
    .select("cost_eur, revenue_generated")
    .eq("organization_id", organizationId)
    .gte("created_at", monthStart.toISOString());

  const campaignCost = (campaigns || []).reduce((s, c) => s + Number(c.cost_eur || 0), 0);
  const campaignRevenue = (campaigns || []).reduce((s, c) => s + Number(c.revenue_generated || 0), 0);

  // ROI lista de espera
  const { data: waitlistSeated } = await supabaseAdmin
    .from("waitlist")
    .select("customer_id")
    .eq("organization_id", organizationId)
    .eq("status", "SEATED")
    .gte("seated_at", monthStart.toISOString());

  // Estimar revenue recuperado por waitlist (€35 por persona sentada)
  const waitlistRevenue = (waitlistSeated || []).length * 35;

  // ROI WhatsApp (revenue de reservas con source_channel = 'whatsapp')
  const { data: waReservations } = await supabaseAdmin
    .from("reservations")
    .select("estimated_revenue, status")
    .eq("organization_id", organizationId)
    .eq("source_channel", "whatsapp")
    .gte("date", monthStart.toISOString())
    .in("status", ["COMPLETED", "CONFIRMED", "SEATED"]);

  const waRevenue = (waReservations || []).reduce((s, r) => s + Number(r.estimated_revenue || 0), 0);

  // ROI fidelización (revenue de clientes con loyalty_tier > BRONZE)
  const { data: loyalReservations } = await supabaseAdmin
    .from("reservations")
    .select("estimated_revenue, status, customer_id, customers(loyalty_tier)")
    .eq("organization_id", organizationId)
    .gte("date", monthStart.toISOString())
    .in("status", ["COMPLETED", "CONFIRMED", "SEATED"]);

  const loyaltyRevenue = (loyalReservations || [])
    .filter((r: any) => r.customers?.loyalty_tier && r.customers.loyalty_tier !== "BRONZE")
    .reduce((s, r) => s + Number(r.estimated_revenue || 0), 0);

  const calcROI = (cost: number, revenue: number) => cost > 0 ? Math.round(((revenue - cost) / cost) * 100) : 0;

  return {
    campaigns: { cost: campaignCost, revenue: campaignRevenue, roi: calcROI(campaignCost, campaignRevenue) },
    reservations: { cost: 0, revenue: 0, roi: 0 }, // TODO: integrar coste de plataforma
    waitlist: { cost: 0, revenue: waitlistRevenue, roi: waitlistRevenue > 0 ? 100 : 0 },
    reviews: { cost: 0, revenue: 0, roi: 0 }, // TODO: integrar con Google Reviews
    whatsapp: { cost: 0, revenue: waRevenue, roi: waRevenue > 0 ? 100 : 0 },
    loyalty: { cost: 0, revenue: loyaltyRevenue, roi: loyaltyRevenue > 0 ? 100 : 0 },
  };
}

// ─── Ingresos perdidos (no-shows + cancelaciones tardías) ────
export async function getLostRevenue(organizationId: string, days: number = 30): Promise<{
  total: number;
  no_shows: number;
  cancellations: number;
  by_day: Array<{ date: string; amount: number }>;
}> {
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { data } = await supabaseAdmin
    .from("reservations")
    .select("date, status, estimated_revenue")
    .eq("organization_id", organizationId)
    .gte("date", start.toISOString())
    .in("status", ["NO_SHOW", "CANCELLED"]);

  const byDay: Record<string, number> = {};
  let noShows = 0, cancellations = 0;

  for (const r of (data || [])) {
    const day = new Date(r.date).toISOString().slice(0, 10);
    const amount = Number(r.estimated_revenue || 0);
    byDay[day] = (byDay[day] || 0) + amount;
    if (r.status === "NO_SHOW") noShows += amount;
    else cancellations += amount;
  }

  return {
    total: noShows + cancellations,
    no_shows: noShows,
    cancellations: cancellations,
    by_day: Object.entries(byDay).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}
