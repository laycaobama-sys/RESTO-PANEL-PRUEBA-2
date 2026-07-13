// ============================================================
// RestoPanel · Fidelización
// ============================================================
// Sistema de puntos, niveles (Bronze→Diamond), recompensas
// canjeables (descuentos, postres, experiencias, eventos).
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export interface LoyaltyConfig {
  points_per_visit: number;
  points_per_euro: number;
  bronze_threshold: number;
  silver_threshold: number;
  gold_threshold: number;
  platinum_threshold: number;
  diamond_threshold: number;
  bronze_multiplier: number;
  silver_multiplier: number;
  gold_multiplier: number;
  platinum_multiplier: number;
  diamond_multiplier: number;
  is_active: boolean;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description: string | null;
  type: 'DISCOUNT' | 'FREE_ITEM' | 'EXPERIENCE' | 'EVENT' | 'UPGRADE' | 'CUSTOM';
  points_cost: number;
  value_eur: number | null;
  discount_type: 'PERCENTAGE' | 'FIXED' | null;
  discount_value: number | null;
  menu_item_id: string | null;
  image_url: string | null;
  is_active: boolean;
  redemption_count: number;
  max_redemptions: number | null;
}

export const TIER_ORDER = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'] as const;
export type Tier = typeof TIER_ORDER[number];

export const TIER_COLORS: Record<Tier, string> = {
  BRONZE: '#CD7F32',
  SILVER: '#C0C0C0',
  GOLD: '#FFD700',
  PLATINUM: '#E5E4E2',
  DIAMOND: '#B9F2FF',
};

export const TIER_ICONS: Record<Tier, string> = {
  BRONZE: '🥉',
  SILVER: '🥈',
  GOLD: '🥇',
  PLATINUM: '💎',
  DIAMOND: '💠',
};

// ─── Obtener configuración de fidelización ───────────────────
export async function getLoyaltyConfig(organizationId: string): Promise<LoyaltyConfig> {
  const { data, error } = await supabaseAdmin
    .from('loyalty_config')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error || !data) {
    // Defaults
    return {
      points_per_visit: 10,
      points_per_euro: 1,
      bronze_threshold: 0,
      silver_threshold: 100,
      gold_threshold: 500,
      platinum_threshold: 1500,
      diamond_threshold: 5000,
      bronze_multiplier: 1.0,
      silver_multiplier: 1.2,
      gold_multiplier: 1.5,
      platinum_multiplier: 2.0,
      diamond_multiplier: 3.0,
      is_active: true,
    };
  }
  return data as any;
}

// ─── Actualizar configuración ────────────────────────────────
export async function updateLoyaltyConfig(
  organizationId: string,
  config: Partial<LoyaltyConfig>
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('loyalty_config')
    .upsert({
      organization_id: organizationId,
      ...config,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id' });
  return !error;
}

// ─── Calcular tier basado en puntos ──────────────────────────
export function getTierForPoints(points: number, config: LoyaltyConfig): Tier {
  if (points >= config.diamond_threshold) return 'DIAMOND';
  if (points >= config.platinum_threshold) return 'PLATINUM';
  if (points >= config.gold_threshold) return 'GOLD';
  if (points >= config.silver_threshold) return 'SILVER';
  return 'BRONZE';
}

// ─── Multiplicador por tier ──────────────────────────────────
export function getTierMultiplier(tier: Tier, config: LoyaltyConfig): number {
  switch (tier) {
    case 'DIAMOND': return config.diamond_multiplier;
    case 'PLATINUM': return config.platinum_multiplier;
    case 'GOLD': return config.gold_multiplier;
    case 'SILVER': return config.silver_multiplier;
    default: return config.bronze_multiplier;
  }
}

// ─── Puntos para próxima tier ────────────────────────────────
export function getNextTierProgress(points: number, config: LoyaltyConfig): {
  currentTier: Tier;
  nextTier: Tier | null;
  pointsToNext: number;
  progressPct: number;
} {
  const currentTier = getTierForPoints(points, config);
  const tierIdx = TIER_ORDER.indexOf(currentTier);
  const nextTier = tierIdx < TIER_ORDER.length - 1 ? TIER_ORDER[tierIdx + 1] : null;

  if (!nextTier) {
    return { currentTier, nextTier: null, pointsToNext: 0, progressPct: 100 };
  }

  const currentThreshold = currentTier === 'BRONZE' ? 0
    : (config as any)[`${currentTier.toLowerCase()}_threshold`];
  const nextThreshold = (config as any)[`${nextTier.toLowerCase()}_threshold`];
  const pointsToNext = nextThreshold - points;
  const progressPct = ((points - currentThreshold) / (nextThreshold - currentThreshold)) * 100;

  return {
    currentTier,
    nextTier,
    pointsToNext,
    progressPct: Math.max(0, Math.min(100, progressPct)),
  };
}

// ─── Añadir puntos a un cliente ──────────────────────────────
export async function addPoints(
  organizationId: string,
  customerId: string,
  points: number,
  reason: string,
  reservationId?: string,
  userId?: string
): Promise<number | null> {
  // Intentar RPC atómica primero
  const { data, error } = await supabaseAdmin.rpc('add_loyalty_points', {
    p_customer_id: customerId,
    p_points: points,
    p_reason: reason,
    p_reservation_id: reservationId || null,
    p_user_id: userId || null,
  });

  if (error) {
    // Fallback manual
    return await manualAddPoints(organizationId, customerId, points, reason, reservationId, userId);
  }

  return data as number;
}

// ─── Fallback manual ─────────────────────────────────────────
async function manualAddPoints(
  organizationId: string,
  customerId: string,
  points: number,
  reason: string,
  reservationId?: string,
  userId?: string
): Promise<number | null> {
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('loyalty_points, loyalty_tier, vip_status')
    .eq('id', customerId)
    .maybeSingle() as any;
  if (!customer) return null;

  const newBalance = (customer.loyalty_points || 0) + points;
  const config = await getLoyaltyConfig(organizationId);
  const newTier = getTierForPoints(newBalance, config);

  await supabaseAdmin
    .from('customers')
    .update({
      loyalty_points: newBalance,
      loyalty_tier: newTier,
      vip_status: newTier === 'PLATINUM' || newTier === 'DIAMOND',
      vip_since: (newTier === 'PLATINUM' || newTier === 'DIAMOND') && !customer.vip_status
        ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId);

  await supabaseAdmin.from('loyalty_transactions').insert({
    organization_id: organizationId,
    customer_id: customerId,
    type: points >= 0 ? 'EARN' : 'REDEEM',
    points,
    balance_after: newBalance,
    reason,
    reservation_id: reservationId || null,
    user_id: userId || null,
  });

  return newBalance;
}

// ─── Canjear recompensa ──────────────────────────────────────
export async function redeemReward(
  organizationId: string,
  customerId: string,
  rewardId: string,
  userId?: string
): Promise<{ success: boolean; message: string; newBalance?: number }> {
  // Cargar recompensa
  const { data: reward, error: rErr } = await supabaseAdmin
    .from('loyalty_rewards')
    .select('*')
    .eq('id', rewardId)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .maybeSingle();
  if (rErr || !reward) {
    return { success: false, message: 'Recompensa no encontrada o inactiva' };
  }

  // Verificar límite de redenciones
  if (reward.max_redemptions && reward.redemption_count >= reward.max_redemptions) {
    return { success: false, message: 'Recompensa agotada' };
  }

  // Verificar validez de fechas
  const now = new Date();
  if (reward.valid_from && new Date(reward.valid_from) > now) {
    return { success: false, message: 'Recompensa aún no disponible' };
  }
  if (reward.valid_until && new Date(reward.valid_until) < now) {
    return { success: false, message: 'Recompensa caducada' };
  }

  // Cargar cliente
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('loyalty_points')
    .eq('id', customerId)
    .maybeSingle();
  if (!customer) {
    return { success: false, message: 'Cliente no encontrado' };
  }

  // Verificar puntos suficientes
  if ((customer.loyalty_points || 0) < reward.points_cost) {
    return { success: false, message: 'Puntos insuficientes' };
  }

  // Descontar puntos
  const newBalance = await addPoints(
    organizationId,
    customerId,
    -reward.points_cost,
    `redeem:${rewardId}`,
    undefined,
    userId
  );

  if (newBalance === null) {
    return { success: false, message: 'Error al descontar puntos' };
  }

  // Incrementar contador de redenciones
  await supabaseAdmin
    .from('loyalty_rewards')
    .update({ redemption_count: (reward.redemption_count || 0) + 1 })
    .eq('id', rewardId);

  return {
    success: true,
    message: 'Recompensa canjeada correctamente',
    newBalance,
  };
}

// ─── Listar recompensas ──────────────────────────────────────
export async function listRewards(organizationId: string, activeOnly: boolean = true): Promise<LoyaltyReward[]> {
  let q = supabaseAdmin
    .from('loyalty_rewards')
    .select('*')
    .eq('organization_id', organizationId)
    .order('points_cost', { ascending: true });
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) return [];
  return (data || []) as any;
}

// ─── Crear recompensa ────────────────────────────────────────
export async function createReward(
  organizationId: string,
  reward: Omit<LoyaltyReward, 'id' | 'redemption_count'>
): Promise<LoyaltyReward | null> {
  const { data, error } = await supabaseAdmin
    .from('loyalty_rewards')
    .insert({
      organization_id: organizationId,
      name: reward.name,
      description: reward.description,
      type: reward.type,
      points_cost: reward.points_cost,
      value_eur: reward.value_eur,
      discount_type: reward.discount_type,
      discount_value: reward.discount_value,
      menu_item_id: reward.menu_item_id,
      image_url: reward.image_url,
      is_active: reward.is_active,
      max_redemptions: reward.max_redemptions,
    })
    .select('*')
    .single();
  if (error) return null;
  return data as any;
}

// ─── Historial de transacciones ──────────────────────────────
export async function getTransactionHistory(
  organizationId: string,
  customerId: string,
  limit: number = 50
): Promise<any[]> {
  const { data, error } = await supabaseAdmin
    .from('loyalty_transactions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

// ─── Puntos ganados tras una reserva completada ──────────────
export async function awardPointsForReservation(
  organizationId: string,
  customerId: string,
  reservationId: string,
  revenue: number,
  userId?: string
): Promise<number | null> {
  const config = await getLoyaltyConfig(organizationId);
  if (!config.is_active) return null;

  // Cargar tier actual del cliente
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('loyalty_tier')
    .eq('id', customerId)
    .maybeSingle();
  if (!customer) return null;

  const multiplier = getTierMultiplier(customer.loyalty_tier as Tier, config);
  const pointsFromVisit = Math.round(config.points_per_visit * multiplier);
  const pointsFromSpend = Math.round(revenue * config.points_per_euro * multiplier);
  const totalPoints = pointsFromVisit + pointsFromSpend;

  return await addPoints(
    organizationId,
    customerId,
    totalPoints,
    `reservation:${reservationId}`,
    reservationId,
    userId
  );
}
