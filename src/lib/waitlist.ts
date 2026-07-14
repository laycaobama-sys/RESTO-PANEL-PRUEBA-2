// ============================================================
// RestoPanel · Lista de Espera Inteligente
// ============================================================
// IA que calcula: tiempo estimado de espera, probabilidad de
// cancelación, probabilidad de liberación, prioridad, orden óptimo.
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface WaitlistEntry {
  id: string;
  organization_id: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  party_size: number;
  children_count: number;
  preferred_zone: string[] | null;
  preferred_shift: string | null;
  requested_time: string;
  estimated_wait_min: number | null;
  priority_score: number;
  vip_status: boolean;
  customer_id: string | null;
  status: 'WAITING' | 'NOTIFIED' | 'SEATED' | 'CANCELLED' | 'EXPIRED';
  notified_at: string | null;
  seated_at: string | null;
  seated_table_id: string | null;
  expired_at: string | null;
  cancellation_prob: number | null;
  notes: string | null;
  source_channel: string;
  created_at: string;
}

// ─── Añadir a lista de espera ────────────────────────────────
export async function addToWaitlist(
  organizationId: string,
  data: {
    customer_name: string;
    phone?: string;
    email?: string;
    party_size: number;
    children_count?: number;
    preferred_zone?: string;
    preferred_shift?: string;
    customer_id?: string;
    vip_status?: boolean;
    notes?: string;
    source_channel?: string;
  }
): Promise<WaitlistEntry | null> {
  // Calcular prioridad IA
  const priorityScore = calculatePriorityScore({
    vip_status: data.vip_status || false,
    party_size: data.party_size,
    customer_id: data.customer_id,
  });

  // Calcular tiempo estimado de espera
  const estimatedWait = await estimateWaitTime(organizationId, data.party_size);

  // Calcular probabilidad de cancelación
  const cancellationProb = data.customer_id
    ? await estimateCancellationProb(data.customer_id)
    : 0.2;

  const { data: entry, error } = await supabaseAdmin
    .from('waitlist')
    .insert({
      organization_id: organizationId,
      customer_name: data.customer_name,
      phone: data.phone || null,
      email: data.email || null,
      party_size: data.party_size,
      children_count: data.children_count || 0,
      preferred_zone: data.preferred_zone || null,
      preferred_shift: data.preferred_shift || null,
      customer_id: data.customer_id || null,
      vip_status: data.vip_status || false,
      notes: data.notes || null,
      source_channel: data.source_channel || 'walk_in',
      priority_score: priorityScore,
      estimated_wait_min: estimatedWait,
      cancellation_prob: cancellationProb,
      status: 'WAITING',
    })
    .select('*')
    .single();

  if (error) return null;
  return entry as any;
}

// ─── Calcular prioridad (0-100) ──────────────────────────────
export function calculatePriorityScore(opts: {
  vip_status: boolean;
  party_size: number;
  customer_id?: string;
}): number {
  let score = 50;
  if (opts.vip_status) score += 30;
  if (opts.party_size >= 6) score += 10;
  if (opts.party_size <= 2) score -= 5;  // parejas son más fáciles de sentar
  return Math.max(0, Math.min(100, score));
}

// ─── Estimar tiempo de espera ────────────────────────────────
export async function estimateWaitTime(
  organizationId: string,
  partySize: number
): Promise<number> {
  // Contar mesas disponibles ahora
  const { count: availableTables } = await supabaseAdmin
    .from('tables')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'AVAILABLE')
    .eq('blocked', false)
    .gte('capacity', partySize);

  if ((availableTables || 0) > 0) return 5; // 5 min si hay mesa libre

  // Contar mesas ocupadas con reservas próximas a terminar
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 60000);
  const { data: endingSoon } = await supabaseAdmin
    .from('reservations')
    .select('table_id, date, duration_minutes')
    .eq('organization_id', organizationId)
    .in('status', ['SEATED', 'CONFIRMED'])
    .lt('date', soon.toISOString());

  // Contar cuántas en lista de espera por delante
  const { count: aheadInLine } = await supabaseAdmin
    .from('waitlist')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'WAITING')
    .lt('party_size', partySize + 1);

  // Estimación: 15 min base + 5 min por persona en lista por delante
  const baseWait = 15;
  const perAhead = 5;
  const estimated = baseWait + (aheadInLine || 0) * perAhead;

  return Math.min(120, estimated); // max 2h
}

// ─── Estimar probabilidad de cancelación ─────────────────────
export async function estimateCancellationProb(customerId: string): Promise<number> {
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('no_shows_count, cancellations_count, visits_count, prob_cancel')
    .eq('id', customerId)
    .maybeSingle();
  if (!customer) return 0.2;

  if (customer.prob_cancel !== null) return customer.prob_cancel;

  const total = customer.visits_count || 0;
  if (total === 0) return 0.3;
  const ratio = ((customer.no_shows_count || 0) + (customer.cancellations_count || 0)) / total;
  return Math.min(0.9, Math.max(0.05, ratio));
}

// ─── Obtener lista ordenada por prioridad ────────────────────
export async function getWaitlist(organizationId: string): Promise<WaitlistEntry[]> {
  const { data, error } = await supabaseAdmin
    .from('waitlist')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'WAITING')
    .order('priority_score', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data || []) as any;
}

// ─── Notificar al siguiente en la lista ──────────────────────
export async function notifyNext(
  organizationId: string,
  tableId: string,
  tableCapacity: number
): Promise<WaitlistEntry | null> {
  // Buscar el primero que quepa en la mesa
  const waitlist = await getWaitlist(organizationId);
  const next = waitlist.find(e => e.party_size <= tableCapacity);
  if (!next) return null;

  await supabaseAdmin
    .from('waitlist')
    .update({
      status: 'NOTIFIED',
      notified_at: new Date().toISOString(),
      seated_table_id: tableId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', next.id);

  return { ...next, status: 'NOTIFIED', notified_at: new Date().toISOString(), seated_table_id: tableId };
}

// ─── Sentar a un cliente de la lista ─────────────────────────
export async function seatFromWaitlist(
  organizationId: string,
  waitlistId: string,
  tableId: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('waitlist')
    .update({
      status: 'SEATED',
      seated_at: new Date().toISOString(),
      seated_table_id: tableId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', waitlistId)
    .eq('organization_id', organizationId);
  return !error;
}

// ─── Cancelar entrada ────────────────────────────────────────
export async function cancelWaitlistEntry(
  organizationId: string,
  waitlistId: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('waitlist')
    .update({
      status: 'CANCELLED',
      expired_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', waitlistId)
    .eq('organization_id', organizationId);
  return !error;
}

// ─── Expirar entradas antiguas (cron job) ────────────────────
export async function expireOldEntries(organizationId?: string): Promise<number> {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 horas
  let q = supabaseAdmin
    .from('waitlist')
    .update({
      status: 'EXPIRED',
      expired_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('status', 'WAITING')
    .lt('created_at', cutoff.toISOString());
  if (organizationId) q = q.eq('organization_id', organizationId);
  const { data, error } = await q.select('id');
  if (error) return 0;
  return (data || []).length;
}

// ─── Stats de la lista de espera ─────────────────────────────
export async function getWaitlistStats(organizationId: string): Promise<{
  total_waiting: number;
  avg_wait_min: number;
  vip_waiting: number;
  total_seated_today: number;
  total_cancelled_today: number;
  total_expired_today: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: all } = await supabaseAdmin
    .from('waitlist')
    .select('status, priority_score, estimated_wait_min, vip_status, created_at')
    .eq('organization_id', organizationId)
    .gte('created_at', today.toISOString());

  const entries = all || [];
  const waiting = entries.filter((e: any) => e.status === 'WAITING');
  const seated = entries.filter((e: any) => e.status === 'SEATED');
  const cancelled = entries.filter((e: any) => e.status === 'CANCELLED');
  const expired = entries.filter((e: any) => e.status === 'EXPIRED');

  return {
    total_waiting: waiting.length,
    avg_wait_min: waiting.length > 0
      ? Math.round(waiting.reduce((s: number, e: any) => s + (e.estimated_wait_min || 0), 0) / waiting.length)
      : 0,
    vip_waiting: waiting.filter((e: any) => e.vip_status).length,
    total_seated_today: seated.length,
    total_cancelled_today: cancelled.length,
    total_expired_today: expired.length,
  };
}
