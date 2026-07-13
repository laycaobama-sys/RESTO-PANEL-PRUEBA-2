// ============================================================
// RestoPanel · Motor de Reservas Inteligente
// ============================================================
// Gestiona horarios dinámicos, capacidad, overbooking y
// validación de reglas por zona/día/festivo/temporada.
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface ScheduleSlot {
  day_of_week: number;
  shift: string;
  open_time: string;
  close_time: string;
  kitchen_close?: string;
  max_capacity?: number;
  max_per_zone: Record<string, number>;
  min_duration_min: number;
  max_duration_min: number;
  buffer_min: number;
  cleanup_min: number;
  max_party_size: number;
  auto_confirm: boolean;
}

export interface ScheduleException {
  date: string;
  type: 'HOLIDAY' | 'SEASON' | 'EVENT' | 'CLOSED' | 'SPECIAL';
  label?: string;
  is_closed: boolean;
  open_time?: string;
  close_time?: string;
  max_capacity?: number;
  special_rules?: Record<string, any>;
}

// ─── Obtener configuración de horarios de una organización ───
export async function getOrganizationSchedule(organizationId: string): Promise<ScheduleSlot[]> {
  const { data, error } = await supabaseAdmin
    .from('reservation_schedule')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('day_of_week')
    .order('open_time');
  if (error) return [];
  return (data || []).map((r: any) => ({
    day_of_week: r.day_of_week,
    shift: r.shift,
    open_time: r.open_time,
    close_time: r.close_time,
    kitchen_close: r.kitchen_close,
    max_capacity: r.max_capacity,
    max_per_zone: r.max_per_zone || {},
    min_duration_min: r.min_duration_min,
    max_duration_min: r.max_duration_min,
    buffer_min: r.buffer_min,
    cleanup_min: r.cleanup_min,
    max_party_size: r.max_party_size,
    auto_confirm: r.auto_confirm,
  }));
}

// ─── Obtener excepciones de horario ──────────────────────────
export async function getScheduleExceptions(
  organizationId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<ScheduleException[]> {
  let q = supabaseAdmin
    .from('schedule_exceptions')
    .select('*')
    .eq('organization_id', organizationId)
    .order('date');
  if (fromDate) q = q.gte('date', fromDate.toISOString().slice(0, 10));
  if (toDate) q = q.lte('date', toDate.toISOString().slice(0, 10));
  const { data, error } = await q;
  if (error) return [];
  return (data || []).map((r: any) => ({
    date: r.date,
    type: r.type,
    label: r.label,
    is_closed: r.is_closed,
    open_time: r.open_time,
    close_time: r.close_time,
    max_capacity: r.max_capacity,
    special_rules: r.special_rules || {},
  }));
}

// ─── Validar si una reserva es posible ───────────────────────
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestedDuration?: number;
  shift?: string;
}

export async function validateReservation(
  organizationId: string,
  date: Date,
  partySize: number,
  durationMin?: number,
  zone?: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Verificar excepciones (festivos / cerrado)
  const exceptions = await getScheduleExceptions(organizationId, date, date);
  const exception = exceptions[0];
  if (exception?.is_closed) {
    errors.push(`El restaurante está cerrado el ${date.toLocaleDateString('es-ES')} (${exception.label || 'festivo'})`);
    return { valid: false, errors, warnings };
  }

  // 2. Verificar horario activo para el día de la semana
  const dayOfWeek = date.getDay();
  const timeStr = date.toTimeString().slice(0, 5);
  const schedule = await getOrganizationSchedule(organizationId);
  const activeSlots = schedule.filter(s => s.day_of_week === dayOfWeek);
  if (activeSlots.length === 0) {
    errors.push('No hay horario configurado para este día');
    return { valid: false, errors, warnings };
  }

  // 3. Encontrar el turno correspondiente
  const matchingSlot = activeSlots.find(s => timeStr >= s.open_time && timeStr <= s.close_time);
  if (!matchingSlot) {
    errors.push(`La hora ${timeStr} está fuera de los horarios activos`);
    return { valid: false, errors, warnings };
  }

  // 4. Verificar tamaño del grupo
  if (partySize < matchingSlot.min_duration_min) {
    errors.push(`El grupo mínimo es ${matchingSlot.min_duration_min} personas`);
  }
  if (partySize > matchingSlot.max_party_size) {
    errors.push(`El grupo máximo es ${matchingSlot.max_party_size} personas`);
  }

  // 5. Verificar capacidad por zona si se especifica
  if (zone && matchingSlot.max_per_zone?.[zone]) {
    // TODO: contar reservas activas en esa zona/hora
  }

  // 6. Calcular duración sugerida si no se proporciona
  const suggestedDuration = durationMin || calculateSmartDuration(partySize, matchingSlot);

  // 7. Verificar cocina abierta
  if (matchingSlot.kitchen_close && timeStr > matchingSlot.kitchen_close) {
    warnings.push(`La cocina cierra a las ${matchingSlot.kitchen_close}. Es posible que no se puedan pedir más platos.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestedDuration,
    shift: matchingSlot.shift,
  };
}

// ─── Calcular duración inteligente según party_size ──────────
export function calculateSmartDuration(partySize: number, slot: ScheduleSlot): number {
  let duration = slot.min_duration_min;
  if (partySize > 4) {
    duration += (partySize - 4) * 15; // +15 min por persona extra
  }
  return Math.min(duration, slot.max_duration_min);
}

// ─── Generar slots disponibles para una fecha ────────────────
export interface AvailableSlot {
  time: string;
  shift: string;
  available: boolean;
  capacity_left: number;
  duration_min: number;
  reason?: string;
}

export async function getAvailableSlots(
  organizationId: string,
  date: Date,
  partySize: number
): Promise<AvailableSlot[]> {
  const dayOfWeek = date.getDay();
  const schedule = await getOrganizationSchedule(organizationId);
  const exceptions = await getScheduleExceptions(organizationId, date, date);

  if (exceptions[0]?.is_closed) {
    return [];
  }

  const activeSlots = schedule.filter(s => s.day_of_week === dayOfWeek);
  const result: AvailableSlot[] = [];

  for (const slot of activeSlots) {
    // Generar slots cada 30 min dentro del horario
    const [openH, openM] = slot.open_time.split(':').map(Number);
    const [closeH, closeM] = slot.close_time.split(':').map(Number);
    let hour = openH;
    let min = openM;
    while (hour < closeH || (hour === closeH && min < closeM)) {
      const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      const duration = calculateSmartDuration(partySize, slot);

      // Verificar si hay mesas disponibles (simplified)
      const slotDate = new Date(date);
      slotDate.setHours(hour, min, 0, 0);

      const { data: conflicts } = await supabaseAdmin
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .in('status', ['CONFIRMED', 'PENDING', 'SEATED'])
        .gte('date', slotDate.toISOString())
        .lt('date', new Date(slotDate.getTime() + duration * 60000).toISOString());

      const conflictCount = (conflicts as any) || 0;

      // Contar mesas disponibles
      const { count: totalTables } = await supabaseAdmin
        .from('tables')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('blocked', false)
        .gte('capacity', partySize);

      const capacityLeft = Math.max(0, (totalTables || 0) - conflictCount);

      result.push({
        time: timeStr,
        shift: slot.shift,
        available: capacityLeft > 0,
        capacity_left: capacityLeft,
        duration_min: duration,
        reason: capacityLeft === 0 ? 'Completo' : undefined,
      });

      min += 30;
      if (min >= 60) {
        hour += 1;
        min = 0;
      }
    }
  }

  return result;
}

// ─── Calcular ingresos estimados de una reserva ──────────────
export function estimateReservationRevenue(
  partySize: number,
  avgTicketPerPerson: number = 35,
  upsells: Array<{ price: number; quantity: number }> = []
): number {
  const base = partySize * avgTicketPerPerson;
  const upsellTotal = upsells.reduce((sum, u) => sum + u.price * u.quantity, 0);
  return base + upsellTotal;
}
