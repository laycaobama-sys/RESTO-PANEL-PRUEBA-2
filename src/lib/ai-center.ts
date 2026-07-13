// ============================================================
// RestoPanel · IA Center — Motor central de IA
// ============================================================
// Analiza continuamente reservas, clientes, ventas, no-shows,
// ocupación, reviews, etc. Genera insights, predicciones y
// recomendaciones.
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export interface AIInsight {
  id: string;
  type: 'opportunity' | 'risk' | 'alert' | 'recommendation' | 'anomaly';
  category: 'revenue' | 'occupancy' | 'customer' | 'operations' | 'marketing';
  severity: 'info' | 'warning' | 'critical' | 'success';
  title: string;
  message: string;
  prediction: {
    value?: number;
    confidence?: number;
    explanation?: string;
    variables?: Record<string, any>;
  };
  recommended_actions: string[];
  is_read: boolean;
  is_dismissed: boolean;
  valid_until: string | null;
  created_at: string;
}

// ─── Generar insights automáticos ────────────────────────────
export async function generateInsights(organizationId: string): Promise<AIInsight[]> {
  const insights: AIInsight[] = [];

  // 1. Analizar no-shows
  const noShowInsight = await analyzeNoShows(organizationId);
  if (noShowInsight) insights.push(noShowInsight);

  // 2. Analizar ocupación
  const occupancyInsight = await analyzeOccupancy(organizationId);
  if (occupancyInsight) insights.push(occupancyInsight);

  // 3. Analizar clientes dormidos
  const dormantInsight = await analyzeDormantCustomers(organizationId);
  if (dormantInsight) insights.push(dormantInsight);

  // 4. Analizar upselling
  const upsellInsight = await analyzeUpsellOpportunity(organizationId);
  if (upsellInsight) insights.push(upsellInsight);

  // 5. Analizar revenue
  const revenueInsight = await analyzeRevenue(organizationId);
  if (revenueInsight) insights.push(revenueInsight);

  // Persistir insights nuevos
  for (const insight of insights) {
    await supabaseAdmin.from("ai_insights").insert({
      organization_id: organizationId,
      type: insight.type,
      category: insight.category,
      severity: insight.severity,
      title: insight.title,
      message: insight.message,
      prediction: insight.prediction,
      recommended_actions: insight.recommended_actions,
    });
  }

  return insights;
}

// ─── Análisis de no-shows ────────────────────────────────────
async function analyzeNoShows(orgId: string): Promise<AIInsight | null> {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const { data } = await supabaseAdmin
    .from("reservations")
    .select("status")
    .eq("organization_id", orgId)
    .gte("date", weekAgo.toISOString());

  if (!data || data.length === 0) return null;

  const total = data.length;
  const noShows = data.filter(r => r.status === "NO_SHOW").length;
  const noShowRate = noShows / total;

  if (noShowRate < 0.1) return null;

  return {
    id: "",
    type: 'risk',
    category: 'operations',
    severity: noShowRate > 0.2 ? 'critical' : 'warning',
    title: `Tasa de no-shows elevada (${(noShowRate * 100).toFixed(0)}%)`,
    message: `${noShows} de ${total} reservas en la última semana fueron no-shows. Esto representa una pérdida estimada de €${(noShows * 35).toFixed(0)}.`,
    prediction: {
      value: noShows * 35,
      confidence: 0.85,
      explanation: `Calculado como ${noShows} no-shows × €35 ticket medio`,
      variables: { no_shows: noShows, total_reservations: total, rate: noShowRate },
    },
    recommended_actions: [
      'Activar confirmación por WhatsApp 24h antes',
      'Solicitar depósito a grupos grandes',
      'Marcar clientes con historial de no-shows',
    ],
    is_read: false,
    is_dismissed: false,
    valid_until: null,
    created_at: new Date().toISOString(),
  };
}

// ─── Análisis de ocupación ───────────────────────────────────
async function analyzeOccupancy(orgId: string): Promise<AIInsight | null> {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const { data: reservations } = await supabaseAdmin
    .from("reservations")
    .select("date, status, party_size")
    .eq("organization_id", orgId)
    .gte("date", weekAgo.toISOString())
    .in("status", ["CONFIRMED", "SEATED", "COMPLETED"]);

  if (!reservations || reservations.length === 0) return null;

  // Agrupar por día de la semana
  const byDow: Record<number, number> = {};
  for (const r of reservations) {
    const dow = new Date(r.date).getDay();
    byDow[dow] = (byDow[dow] || 0) + r.party_size;
  }

  // Encontrar el día con menos ocupación
  const dows = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  let minDay = 0, minCovers = Infinity;
  for (let i = 0; i < 7; i++) {
    if ((byDow[i] || 0) < minCovers) {
      minCovers = byDow[i] || 0;
      minDay = i;
    }
  }

  if (minCovers > 20) return null;

  return {
    id: "",
    type: 'opportunity',
    category: 'occupancy',
    severity: 'info',
    title: `Baja ocupación los ${dows[minDay]}`,
    message: `Los ${dows[minDay]} tienes un promedio de ${minCovers} comensales. Una campaña dirigida podría aumentar la ocupación un 30-50%.`,
    prediction: {
      value: minCovers * 0.4,
      confidence: 0.7,
      explanation: `Estimación basada en campañas similares en el sector`,
      variables: { day_of_week: dows[minDay], avg_covers: minCovers },
    },
    recommended_actions: [
      `Crear campaña de email para ${dows[minDay]}`,
      'Ofrecer descuento del 10% en reservas de ese día',
      'Activar recordatorio automático por WhatsApp',
    ],
    is_read: false,
    is_dismissed: false,
    valid_until: null,
    created_at: new Date().toISOString(),
  };
}

// ─── Análisis de clientes dormidos ───────────────────────────
async function analyzeDormantCustomers(orgId: string): Promise<AIInsight | null> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const { count } = await supabaseAdmin
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .lt("last_visit_at", ninetyDaysAgo.toISOString())
    .is("deleted_at", null);

  if (!count || count < 5) return null;

  return {
    id: "",
    type: 'opportunity',
    category: 'marketing',
    severity: 'info',
    title: `${count} clientes dormidos (90+ días sin visitar)`,
    message: `Tienes ${count} clientes que no han visitado tu restaurante en más de 90 días. Una campaña de reactivación podría recuperar el 15-25% de ellos.`,
    prediction: {
      value: count * 0.2 * 35,
      confidence: 0.65,
      explanation: `20% de recuperación × €35 ticket medio`,
      variables: { dormant_customers: count },
    },
    recommended_actions: [
      'Crear campaña "Te echamos de menos" con descuento',
      'Segmentar por valor histórico (VIP primero)',
      'Enviar por WhatsApp (mayor tasa de apertura)',
    ],
    is_read: false,
    is_dismissed: false,
    valid_until: null,
    created_at: new Date().toISOString(),
  };
}

// ─── Análisis de upselling ───────────────────────────────────
async function analyzeUpsellOpportunity(orgId: string): Promise<AIInsight | null> {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const { data: reservations } = await supabaseAdmin
    .from("reservations")
    .select("id")
    .eq("organization_id", orgId)
    .gte("date", weekAgo.toISOString())
    .in("status", ["CONFIRMED", "SEATED", "COMPLETED"]);

  const { data: upsells } = await supabaseAdmin
    .from("reservation_upsells")
    .select("total_price")
    .eq("organization_id", orgId)
    .gte("created_at", weekAgo.toISOString())
    .neq("status", "CANCELLED");

  if (!reservations || reservations.length === 0) return null;

  const reservationsWithoutUpsell = reservations.length - (upsells?.length || 0);
  if (reservationsWithoutUpsell < 10) return null;

  const potentialRevenue = reservationsWithoutUpsell * 15; // €15 upsell medio

  return {
    id: "",
    type: 'opportunity',
    category: 'revenue',
    severity: 'success',
    title: `Oportunidad de upselling en ${reservationsWithoutUpsell} reservas`,
    message: `${reservationsWithoutUpsell} reservas de la última semana no incluyeron upselling. Potencial de €${potentialRevenue} adicionales.`,
    prediction: {
      value: potentialRevenue,
      confidence: 0.75,
      explanation: `${reservationsWithoutUpsell} reservas × €15 upsell medio`,
      variables: { reservations_without_upsell: reservationsWithoutUpsell },
    },
    recommended_actions: [
      'Activar recomendaciones automáticas en checkout',
      'Configurar items de upselling (vino, postres, menú degustación)',
      'Capacitar al personal para ofrecer upselling',
    ],
    is_read: false,
    is_dismissed: false,
    valid_until: null,
    created_at: new Date().toISOString(),
  };
}

// ─── Análisis de revenue ─────────────────────────────────────
async function analyzeRevenue(orgId: string): Promise<AIInsight | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  const { data: yesterdayRev } = await supabaseAdmin
    .from("reservations")
    .select("estimated_revenue, status")
    .eq("organization_id", orgId)
    .gte("date", yesterday.toISOString())
    .lt("date", today.toISOString());

  const { data: todayRev } = await supabaseAdmin
    .from("reservations")
    .select("estimated_revenue, status")
    .eq("organization_id", orgId)
    .gte("date", today.toISOString());

  const yRev = (yesterdayRev || []).filter(r => r.status === "COMPLETED").reduce((s, r) => s + Number(r.estimated_revenue || 0), 0);
  const tRevPending = (todayRev || []).filter(r => ["CONFIRMED", "PENDING", "SEATED"].includes(r.status)).reduce((s, r) => s + Number(r.estimated_revenue || 0), 0);

  if (yRev === 0 || tRevPending === 0) return null;

  const change = ((tRevPending - yRev) / yRev) * 100;

  if (Math.abs(change) < 15) return null;

  return {
    id: "",
    type: change > 0 ? 'recommendation' : 'alert',
    category: 'revenue',
    severity: change < -20 ? 'critical' : 'info',
    title: `Ingresos de hoy ${change > 0 ? '+' : ''}${change.toFixed(0)}% vs ayer`,
    message: `Hoy tienes €${tRevPending.toFixed(0)} en reservas confirmadas vs €${yRev.toFixed(0)} ayer a esta hora.`,
    prediction: {
      value: tRevPending,
      confidence: 0.9,
      explanation: `Comparativa de ingresos confirmados día vs día`,
      variables: { today: tRevPending, yesterday: yRev, change_pct: change },
    },
    recommended_actions: change < 0
      ? ['Activar campaña de última hora', 'Ofrecer descuento flash', 'Contactar clientes VIP sin reserva']
      : ['Mantener estrategia actual', 'Preparar inventario para demanda'],
    is_read: false,
    is_dismissed: false,
    valid_until: null,
    created_at: new Date().toISOString(),
  };
}

// ─── Listar insights ─────────────────────────────────────────
export async function listInsights(organizationId: string, limit: number = 20): Promise<AIInsight[]> {
  const { data, error } = await supabaseAdmin
    .from("ai_insights")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_dismissed", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []) as any;
}

// ─── Marcar insight como leído ───────────────────────────────
export async function markInsightRead(organizationId: string, insightId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("ai_insights")
    .update({ is_read: true })
    .eq("id", insightId)
    .eq("organization_id", organizationId);
  return !error;
}

// ─── Descartar insight ───────────────────────────────────────
export async function dismissInsight(organizationId: string, insightId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("ai_insights")
    .update({ is_dismissed: true })
    .eq("id", insightId)
    .eq("organization_id", organizationId);
  return !error;
}

// ─── Predicción diaria ───────────────────────────────────────
export async function predictDaily(organizationId: string, date: Date): Promise<{
  predicted_revenue: number;
  predicted_covers: number;
  predicted_occupancy: number;
  predicted_no_shows: number;
  predicted_cancellations: number;
  confidence: number;
  variables: Record<string, any>;
}> {
  // Buscar histórico de últimos 4 semanas en el mismo día de la semana
  const dow = date.getDay();
  const fourWeeksAgo = new Date(date.getTime() - 28 * 24 * 60 * 60 * 1000);

  const { data: historical } = await supabaseAdmin
    .from("reservations")
    .select("date, status, party_size, estimated_revenue")
    .eq("organization_id", organizationId)
    .gte("date", fourWeeksAgo.toISOString())
    .lt("date", date.toISOString());

  if (!historical || historical.length === 0) {
    return {
      predicted_revenue: 0,
      predicted_covers: 0,
      predicted_occupancy: 0,
      predicted_no_shows: 0,
      predicted_cancellations: 0,
      confidence: 0.3,
      variables: { reason: "no_historical_data" },
    };
  }

  // Filtrar solo mismo día de la semana
  const sameDow = (historical as any[]).filter(r => new Date(r.date).getDay() === dow);
  const completed = sameDow.filter(r => r.status === "COMPLETED");
  const noShows = sameDow.filter(r => r.status === "NO_SHOW").length;
  const cancelled = sameDow.filter(r => r.status === "CANCELLED").length;

  const avgRevenue = completed.length > 0
    ? completed.reduce((s, r) => s + Number(r.estimated_revenue || 0), 0) / completed.length
    : 0;
  const avgCovers = completed.length > 0
    ? completed.reduce((s, r) => s + r.party_size, 0) / completed.length
    : 0;

  // Tendencia (comparar últimas 2 semanas vs primeras 2)
  const twoWeeksAgo = new Date(date.getTime() - 14 * 24 * 60 * 60 * 1000);
  const recent = sameDow.filter(r => new Date(r.date) >= twoWeeksAgo);
  const older = sameDow.filter(r => new Date(r.date) < twoWeeksAgo);
  const recentAvg = recent.length > 0 ? recent.reduce((s, r) => s + Number(r.estimated_revenue || 0), 0) / recent.length : avgRevenue;
  const olderAvg = older.length > 0 ? older.reduce((s, r) => s + Number(r.estimated_revenue || 0), 0) / older.length : avgRevenue;
  const trend = olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0;

  // Aplicar tendencia
  const predictedRevenue = avgRevenue * (1 + trend * 0.5);

  return {
    predicted_revenue: Math.round(predictedRevenue * 100) / 100,
    predicted_covers: Math.round(avgCovers),
    predicted_occupancy: Math.min(100, Math.round((avgCovers / 50) * 100)),
    predicted_no_shows: Math.round(noShows / 4),
    predicted_cancellations: Math.round(cancelled / 4),
    confidence: Math.min(0.95, 0.5 + (sameDow.length / 20)),
    variables: {
      same_dow_samples: sameDow.length,
      avg_revenue: avgRevenue,
      trend_pct: trend * 100,
      avg_covers: avgCovers,
    },
  };
}
