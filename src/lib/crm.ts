// ============================================================
// RestoPanel · CRM Enterprise Service
// ============================================================
// Gestiona fichas de cliente completas, segmentación automática,
// predicciones IA, interacciones y métricas LTV.
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface CustomerWithMetrics {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  anniversary: string | null;
  language: string;
  preferred_zone: string | null;
  preferred_table_id: string | null;
  allergies: string[];
  dietary_restrictions: string[];
  favorite_drink: string | null;
  favorite_wine: string | null;
  internal_notes: string | null;
  acquisition_channel: string | null;
  loyalty_tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
  loyalty_points: number;
  lifetime_value: number;
  avg_ticket: number;
  avg_stay_min: number;
  visits_count: number;
  no_shows_count: number;
  cancellations_count: number;
  last_visit_at: string | null;
  next_reservation_at: string | null;
  prob_return: number | null;
  prob_cancel: number | null;
  segment: string | null;
  risk_score: number | null;
  vip_status: boolean;
  vip_since: string | null;
  tags: string[];
  marketing_opt_in: boolean;
  created_at: string;
}

// ─── Listar clientes con métricas ────────────────────────────
export async function listCustomers(
  organizationId: string,
  opts: {
    search?: string;
    segment?: string;
    tier?: string;
    vipOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ customers: CustomerWithMetrics[]; total: number }> {
  let q = supabaseAdmin
    .from('customers')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null);

  if (opts.search) {
    q = q.or(`name.ilike.%${opts.search}%,email.ilike.%${opts.search}%,phone.ilike.%${opts.search}%`);
  }
  if (opts.segment) q = q.eq('segment', opts.segment);
  if (opts.tier) q = q.eq('loyalty_tier', opts.tier);
  if (opts.vipOnly) q = q.eq('vip_status', true);

  q = q.order('created_at', { ascending: false }).limit(opts.limit || 50);
  if (opts.offset) q = q.range(opts.offset, opts.offset + (opts.limit || 50) - 1);

  const { data, count, error } = await q;
  if (error) return { customers: [], total: 0 };
  return { customers: (data || []) as any, total: count || 0 };
}

// ─── Obtener ficha completa de un cliente ────────────────────
export async function getCustomerProfile(
  organizationId: string,
  customerId: string
): Promise<CustomerWithMetrics | null> {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error || !data) return null;
  return data as any;
}

// ─── Recalcular métricas de un cliente ───────────────────────
export async function recalcCustomer(customerId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('recalculate_customer_metrics', { p_customer_id: customerId });
  if (error) {
    // Recalcular manualmente si la RPC no existe
    await manualRecalc(customerId);
    return;
  }
  await supabaseAdmin.rpc('recalculate_customer_segment', { p_customer_id: customerId });
}

// ─── Recalculo manual (fallback) ─────────────────────────────
async function manualRecalc(customerId: string): Promise<void> {
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('organization_id')
    .eq('id', customerId)
    .maybeSingle();
  if (!customer) return;

  const { data: reservations } = await supabaseAdmin
    .from('reservations')
    .select('status, estimated_revenue, date, created_at, updated_at')
    .eq('customer_id', customerId);

  const visits = (reservations || []).filter((r: any) => r.status === 'COMPLETED').length;
  const noShows = (reservations || []).filter((r: any) => r.status === 'NO_SHOW').length;
  const cancels = (reservations || []).filter((r: any) => r.status === 'CANCELLED').length;
  const completed = (reservations || []).filter((r: any) => r.status === 'COMPLETED');
  const ltv = completed.reduce((sum: number, r: any) => sum + Number(r.estimated_revenue || 0), 0);
  const avgTicket = visits > 0 ? ltv / visits : 0;
  const lastVisit = completed.length > 0
    ? completed.reduce((max: string, r: any) => r.date > max ? r.date : max, completed[0].date)
    : null;

  let probReturn = 0.5;
  if (lastVisit) {
    const daysSince = Math.floor((Date.now() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince < 30) probReturn = 0.85;
    else if (daysSince < 90) probReturn = 0.65;
    else if (daysSince < 180) probReturn = 0.35;
    else probReturn = 0.15;
  }

  const probCancel = visits > 0
    ? Math.min(0.9, (cancels + noShows) / visits)
    : 0.1;

  await supabaseAdmin
    .from('customers')
    .update({
      visits_count: visits,
      no_shows_count: noShows,
      cancellations_count: cancels,
      lifetime_value: ltv,
      avg_ticket: avgTicket,
      last_visit_at: lastVisit,
      prob_return: probReturn,
      prob_cancel: probCancel,
      risk_score: probCancel * 100,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId);
}

// ─── Segmentación automática ─────────────────────────────────
export interface SegmentStats {
  segment: string;
  count: number;
  avg_ltv: number;
  avg_risk: number;
  description: string;
}

export async function getSegmentStats(organizationId: string): Promise<SegmentStats[]> {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('segment, lifetime_value, risk_score')
    .eq('organization_id', organizationId)
    .is('deleted_at', null);

  if (error || !data) return [];

  const segments: Record<string, { count: number; ltv: number; risk: number }> = {};
  for (const c of data as any[]) {
    const seg = c.segment || 'NEW';
    if (!segments[seg]) segments[seg] = { count: 0, ltv: 0, risk: 0 };
    segments[seg].count++;
    segments[seg].ltv += Number(c.lifetime_value || 0);
    segments[seg].risk += Number(c.risk_score || 0);
  }

  const descriptions: Record<string, string> = {
    VIP: 'Clientes VIP con alto valor',
    FREQUENT: 'Clientes frecuentes (10+ visitas)',
    NEW: 'Clientes nuevos (sin visitas)',
    REGULAR: 'Clientes regulares',
    HIGH_VALUE: 'Clientes de alto gasto',
    DORMANT: 'Inactivos 180+ días',
    AT_RISK: 'En riesgo (90+ días o cancelaciones)',
    NO_SHOW: 'Histórico de no-shows',
  };

  return Object.entries(segments).map(([segment, s]) => ({
    segment,
    count: s.count,
    avg_ltv: s.count > 0 ? s.ltv / s.count : 0,
    avg_risk: s.count > 0 ? s.risk / s.count : 0,
    description: descriptions[segment] || segment,
  }));
}

// ─── Buscar clientes similares ───────────────────────────────
export async function findSimilarCustomers(
  organizationId: string,
  customerId: string,
  limit: number = 5
): Promise<CustomerWithMetrics[]> {
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('segment, loyalty_tier, preferred_zone, avg_ticket')
    .eq('id', customerId)
    .maybeSingle();
  if (!customer) return [];

  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('organization_id', organizationId)
    .neq('id', customerId)
    .is('deleted_at', null)
    .or(`segment.eq.${customer.segment},loyalty_tier.eq.${customer.loyalty_tier}`)
    .order('lifetime_value', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as any;
}

// ─── Registrar interacción con cliente ───────────────────────
export async function logCustomerInteraction(
  organizationId: string,
  customerId: string,
  type: string,
  data: { channel?: string; subject?: string; body?: string; userId?: string; metadata?: any }
): Promise<void> {
  await supabaseAdmin.from('customer_interactions').insert({
    organization_id: organizationId,
    customer_id: customerId,
    type,
    channel: data.channel || null,
    subject: data.subject || null,
    body: data.body || null,
    user_id: data.userId || null,
    metadata: data.metadata || {},
  });
}

// ─── Obtener historial de interacciones ──────────────────────
export async function getCustomerInteractions(
  organizationId: string,
  customerId: string,
  limit: number = 50
): Promise<any[]> {
  const { data, error } = await supabaseAdmin
    .from('customer_interactions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

// ─── Obtener predicciones IA de un cliente ───────────────────
export async function getCustomerPredictions(
  organizationId: string,
  customerId: string
): Promise<any | null> {
  const { data, error } = await supabaseAdmin
    .from('customer_predictions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// ─── Calcular predicciones IA simples ────────────────────────
export function calculatePredictions(customer: any): {
  prob_cancel: number;
  prob_no_show: number;
  prob_return: number;
  prob_upsell: number;
  prob_vip: number;
  prob_churn: number;
  risk_score: number;
  cluster: string;
  predicted_ltv: number;
} {
  const visits = customer.visits_count || 0;
  const noShows = customer.no_shows_count || 0;
  const cancels = customer.cancellations_count || 0;
  const ltv = Number(customer.lifetime_value || 0);
  const avgTicket = Number(customer.avg_ticket || 0);

  // Probabilidad de cancelar
  const prob_cancel = visits > 0
    ? Math.min(0.9, (cancels + noShows) / visits)
    : 0.1;

  // Probabilidad de no-show
  const prob_no_show = visits > 0
    ? Math.min(0.5, noShows / visits)
    : 0.05;

  // Probabilidad de volver
  let prob_return = 0.5;
  if (customer.last_visit_at) {
    const days = Math.floor((Date.now() - new Date(customer.last_visit_at).getTime()) / (1000 * 60 * 60 * 24));
    if (days < 30) prob_return = 0.85;
    else if (days < 90) prob_return = 0.65;
    else if (days < 180) prob_return = 0.35;
    else prob_return = 0.15;
  }
  if (visits >= 10) prob_return = Math.max(prob_return, 0.75);

  // Probabilidad de upsell (basada en ticket medio)
  const prob_upsell = avgTicket > 50 ? 0.6 : avgTicket > 30 ? 0.4 : 0.2;

  // Probabilidad de ser VIP
  const prob_vip = ltv > 1000 ? 0.8 : ltv > 500 ? 0.5 : ltv > 200 ? 0.2 : 0.05;

  // Probabilidad de churn
  let prob_churn = 0.2;
  if (customer.last_visit_at) {
    const days = Math.floor((Date.now() - new Date(customer.last_visit_at).getTime()) / (1000 * 60 * 60 * 24));
    if (days > 180) prob_churn = 0.8;
    else if (days > 90) prob_churn = 0.5;
    else if (days > 60) prob_churn = 0.3;
  }

  // Score de riesgo
  const risk_score = (prob_cancel * 0.5 + prob_no_show * 0.3 + prob_churn * 0.2) * 100;

  // Cluster / segmento
  let cluster = 'NEW';
  if (visits === 0) cluster = 'NEW';
  else if (customer.vip_status) cluster = 'VIP';
  else if (noShows >= 2) cluster = 'NO_SHOW';
  else if (cancels >= 3) cluster = 'RISK';
  else if (customer.last_visit_at) {
    const days = Math.floor((Date.now() - new Date(customer.last_visit_at).getTime()) / (1000 * 60 * 60 * 24));
    if (days > 180) cluster = 'DORMANT';
    else if (days > 90) cluster = 'RISK';
    else if (visits >= 10) cluster = 'FREQUENT';
    else if (ltv >= 500) cluster = 'HIGH_VALUE';
    else cluster = 'REGULAR';
  }

  // LTV predicho (basado en avg_ticket * visitas esperadas en 12 meses)
  const expectedVisitsNext12m = Math.max(1, visits / Math.max(1, (Date.now() - new Date(customer.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365)));
  const predicted_ltv = avgTicket * expectedVisitsNext12m * 1.2;

  return {
    prob_cancel: Math.round(prob_cancel * 100) / 100,
    prob_no_show: Math.round(prob_no_show * 100) / 100,
    prob_return: Math.round(prob_return * 100) / 100,
    prob_upsell: Math.round(prob_upsell * 100) / 100,
    prob_vip: Math.round(prob_vip * 100) / 100,
    prob_churn: Math.round(prob_churn * 100) / 100,
    risk_score: Math.round(risk_score * 100) / 100,
    cluster,
    predicted_ltv: Math.round(predicted_ltv * 100) / 100,
  };
}
