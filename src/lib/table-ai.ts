// ============================================================
// RestoPanel · IA de Asignación de Mesas
// ============================================================
// Algoritmo de puntuación que propone la mejor mesa para una
// reserva, considerando: party_size, niños, accesibilidad, zona
// favorita, VIP, historial, tiempo estimado, ocupación prevista,
// agrupaciones, mesas bloqueadas, eventos.
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface TableSuggestion {
  table_id: string;
  table_number: string;
  table_name: string;
  zone: string;
  shape: string;
  capacity: number;
  score: number;
  reasons: string[];
}

export interface AssignmentContext {
  organizationId: string;
  partySize: number;
  childrenCount?: number;
  highChairCount?: number;
  accessibilityNeeded?: boolean;
  preferredZone?: string;
  customerId?: string;
  date: Date;
  durationMin: number;
  isVip?: boolean;
}

// ─── Sugerir mejores mesas para una reserva ──────────────────
export async function suggestTables(ctx: AssignmentContext): Promise<TableSuggestion[]> {
  // Llamar a la RPC de Postgres que hace el algoritmo de puntuación
  const { data, error } = await supabaseAdmin.rpc('suggest_table_for_reservation', {
    p_organization_id: ctx.organizationId,
    p_party_size: ctx.partySize,
    p_date: ctx.date.toISOString(),
    p_duration_min: ctx.durationMin,
    p_preferred_zone: ctx.preferredZone || null,
    p_customer_id: ctx.customerId || null,
    p_children_count: ctx.childrenCount || 0,
    p_accessibility_needed: ctx.accessibilityNeeded || false,
  });

  if (error) {
    // Fallback: hacer la consulta manual
    return await manualSuggest(ctx);
  }

  return (data || []).map((r: any) => ({
    table_id: r.table_id,
    table_number: r.table_number,
    table_name: r.table_name,
    zone: r.zone,
    shape: r.shape,
    capacity: r.capacity,
    score: Number(r.score),
    reasons: r.reasons || [],
  }));
}

// ─── Fallback manual (sin RPC) ───────────────────────────────
async function manualSuggest(ctx: AssignmentContext): Promise<TableSuggestion[]> {
  const slotStart = ctx.date;
  const slotEnd = new Date(ctx.date.getTime() + ctx.durationMin * 60000);

  // Cargar preferencias del cliente
  let customer: any = null;
  if (ctx.customerId) {
    const { data } = await supabaseAdmin
      .from('customers')
      .select('preferred_zone, preferred_table_id, vip_status, loyalty_tier')
      .eq('id', ctx.customerId)
      .maybeSingle();
    customer = data;
  }

  // Cargar mesas disponibles
  const { data: tables } = await supabaseAdmin
    .from('tables')
    .select('id, number, name, zone, shape, capacity, blocked, status')
    .eq('organization_id', ctx.organizationId)
    .eq('blocked', false)
    .neq('status', 'OUT_OF_SERVICE')
    .gte('capacity', ctx.partySize);

  if (!tables || tables.length === 0) return [];

  // Filtrar mesas con overbooking
  const { data: conflicts } = await supabaseAdmin
    .from('reservations')
    .select('table_id')
    .eq('organization_id', ctx.organizationId)
    .in('status', ['CONFIRMED', 'PENDING', 'SEATED'])
    .lt('date', slotEnd.toISOString())
    .gt('date', new Date(slotStart.getTime() - 180 * 60000).toISOString());

  const conflictTableIds = new Set((conflicts || []).map((c: any) => c.table_id));

  // Puntuar cada mesa
  const suggestions: TableSuggestion[] = [];
  for (const t of tables) {
    if (conflictTableIds.has(t.id)) continue;

    let score = 50;
    const reasons: string[] = [];

    // Capacidad óptima
    if (t.capacity === ctx.partySize) {
      score += 50;
      reasons.push('Capacidad exacta');
    } else if (t.capacity <= ctx.partySize + 2) {
      score += 30;
      reasons.push('Capacidad óptima');
    } else if (t.capacity > ctx.partySize + 4) {
      score -= 10;
    }

    // Zona preferida
    if (ctx.preferredZone && t.zone === ctx.preferredZone) {
      score += 20;
      reasons.push('Zona preferida');
    }

    // Zona favorita del cliente
    if (customer?.preferred_zone && t.zone === customer.preferred_zone) {
      score += 15;
      reasons.push('Zona favorita del cliente');
    }

    // Mesa favorita
    if (customer?.preferred_table_id && t.id === customer.preferred_table_id) {
      score += 30;
      reasons.push('Mesa favorita del cliente');
    }

    // VIP: priorizar zonas VIP
    if (customer?.vip_status || ctx.isVip) {
      if (t.zone === 'VIP') {
        score += 25;
        reasons.push('Cliente VIP');
      }
    }

    // Accesibilidad
    if (ctx.accessibilityNeeded) {
      if (t.shape === 'SQUARE' || t.shape === 'RECTANGLE') {
        score += 10;
        reasons.push('Accesible');
      }
    }

    // Niños: priorizar mesas amplias
    if ((ctx.childrenCount || 0) > 0 && t.shape === 'RECTANGLE') {
      score += 10;
      reasons.push('Apta para niños');
    }

    suggestions.push({
      table_id: t.id,
      table_number: t.number,
      table_name: t.name || `Mesa ${t.number}`,
      zone: t.zone,
      shape: t.shape,
      capacity: t.capacity,
      score,
      reasons,
    });
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, 5);
}

// ─── Asignar mesa automáticamente (la mejor) ─────────────────
export async function autoAssignTable(ctx: AssignmentContext): Promise<TableSuggestion | null> {
  const suggestions = await suggestTables(ctx);
  if (suggestions.length === 0) return null;

  const best = suggestions[0];
  // Si la mejor puntuación es < 30, no asignar automáticamente
  if (best.score < 30) return null;

  return best;
}

// ─── Predecir ocupación futura de una mesa ───────────────────
export async function predictTableOccupancy(
  organizationId: string,
  tableId: string,
  fromDate: Date,
  days: number = 7
): Promise<Array<{ date: Date; utilization: number; reservations: number }>> {
  const toDate = new Date(fromDate.getTime() + days * 24 * 60 * 60 * 1000);

  const { data } = await supabaseAdmin
    .from('reservations')
    .select('date, duration_minutes, party_size')
    .eq('organization_id', organizationId)
    .eq('table_id', tableId)
    .in('status', ['CONFIRMED', 'PENDING', 'SEATED'])
    .gte('date', fromDate.toISOString())
    .lt('date', toDate.toISOString())
    .order('date');

  const result: Array<{ date: Date; utilization: number; reservations: number }> = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(fromDate);
    day.setDate(day.getDate() + i);
    const dayRes = (data || []).filter((r: any) => {
      const rd = new Date(r.date);
      return rd.toDateString() === day.toDateString();
    });
    const totalMin = dayRes.reduce((sum: number, r: any) => sum + (r.duration_minutes || 120), 0);
    result.push({
      date: day,
      utilization: Math.min(100, (totalMin / (12 * 60)) * 100), // % de 12h operativas
      reservations: dayRes.length,
    });
  }
  return result;
}
