// ============================================================
// RestoPanel · KDS (Kitchen Display System) Service
// ============================================================
// Gestión de estaciones de cocina, estados de pedidos,
// temporizadores, prioridades, filtros por estación.
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";

export type KDSStatus = 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

// ─── Obtener items activos para KDS ──────────────────────────
export async function getKDSItems(organizationId: string, stationId?: string) {
  let q = supabaseAdmin
    .from("order_items")
    .select(`
      id, kds_status, kds_priority, kds_notes, kds_accepted_at, kds_ready_at, kds_served_at,
      quantity, notes, created_at,
      menu_items(name, image),
      orders(id, number, table_id, tables(number, name)),
      kitchen_stations(id, name, color)
    `)
    .eq("organization_id", organizationId)
    .in("kds_status", ["PENDING", "ACCEPTED", "PREPARING", "READY"])
    .order("kds_priority", { ascending: false })
    .order("created_at", { ascending: true });

  if (stationId) q = q.eq("kds_station_id", stationId);

  const { data, error } = await q;
  if (error) return [];
  return data || [];
}

// ─── Cambiar estado de un item KDS ───────────────────────────
export async function updateKDSStatus(
  organizationId: string,
  itemId: string,
  status: KDSStatus
): Promise<boolean> {
  const updates: any = { kds_status: status };
  if (status === 'ACCEPTED') updates.kds_accepted_at = new Date().toISOString();
  if (status === 'PREPARING') updates.kds_accepted_at = updates.kds_accepted_at || new Date().toISOString();
  if (status === 'READY') updates.kds_ready_at = new Date().toISOString();
  if (status === 'SERVED') updates.kds_served_at = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("order_items")
    .update(updates)
    .eq("id", itemId)
    .eq("organization_id", organizationId);

  return !error;
}

// ─── Asignar estación a un item ──────────────────────────────
export async function assignStation(
  organizationId: string,
  itemId: string,
  stationId: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("order_items")
    .update({ kds_station_id: stationId })
    .eq("id", itemId)
    .eq("organization_id", organizationId);
  return !error;
}

// ─── Cambiar prioridad ───────────────────────────────────────
export async function setPriority(
  organizationId: string,
  itemId: string,
  priority: number
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("order_items")
    .update({ kds_priority: priority })
    .eq("id", itemId)
    .eq("organization_id", organizationId);
  return !error;
}

// ─── Estadísticas KDS ────────────────────────────────────────
export async function getKDSStats(organizationId: string) {
  const { data } = await supabaseAdmin
    .from("order_items")
    .select("kds_status, kds_accepted_at, kds_ready_at, created_at")
    .eq("organization_id", organizationId)
    .in("kds_status", ["PENDING", "ACCEPTED", "PREPARING", "READY"]);

  const stats = {
    pending: 0,
    accepted: 0,
    preparing: 0,
    ready: 0,
    avg_prep_time_min: 0,
  };

  const prepTimes: number[] = [];
  for (const item of (data || [])) {
    if (item.kds_status === 'PENDING') stats.pending++;
    else if (item.kds_status === 'ACCEPTED') stats.accepted++;
    else if (item.kds_status === 'PREPARING') stats.preparing++;
    else if (item.kds_status === 'READY') {
      stats.ready++;
      if (item.kds_accepted_at && item.kds_ready_at) {
        const min = (new Date(item.kds_ready_at).getTime() - new Date(item.kds_accepted_at).getTime()) / 60000;
        if (min > 0 && min < 180) prepTimes.push(min);
      }
    }
  }

  if (prepTimes.length > 0) {
    stats.avg_prep_time_min = Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length);
  }

  return stats;
}

// ─── Listar estaciones de cocina ─────────────────────────────
export async function listStations(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from("kitchen_stations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("sort_order");
  if (error) return [];
  return data || [];
}

// ─── Crear estación ──────────────────────────────────────────
export async function createStation(
  organizationId: string,
  name: string,
  type: string,
  color: string = '#C5A059'
): Promise<any> {
  const { data, error } = await supabaseAdmin
    .from("kitchen_stations")
    .insert({
      organization_id: organizationId,
      name,
      type,
      color,
    })
    .select("*")
    .single();
  if (error) return null;
  return data;
}
