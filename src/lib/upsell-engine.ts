// ============================================================
// RestoPanel · Motor de Upselling IA
// ============================================================
// Recomienda items de upselling según hora, mesa, party_size,
// historial, preferencias, temporada, eventos.
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface UpsellRecommendation {
  upsell_item_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string;
  score: number;
  reason: string;
}

// ─── Generar recomendaciones para una reserva ────────────────
export async function recommendUpsells(opts: {
  organizationId: string;
  reservationId?: string;
  customerId?: string;
  partySize: number;
  date: Date;
  zone?: string;
}): Promise<UpsellRecommendation[]> {
  // Cargar items activos
  const { data: items } = await supabaseAdmin
    .from("upsell_items")
    .select("*")
    .eq("organization_id", opts.organizationId)
    .eq("is_active", true)
    .order("sort_order");

  if (!items || items.length === 0) return [];

  // Cargar preferencias del cliente si existe
  let customer: any = null;
  if (opts.customerId) {
    const { data } = await supabaseAdmin
      .from("customers")
      .select("favorite_drink, favorite_wine, allergies, dietary_restrictions, loyalty_tier, avg_ticket")
      .eq("id", opts.customerId)
      .maybeSingle();
    customer = data;
  }

  // Cargar upsells anteriores del cliente
  let previousUpsells: string[] = [];
  if (opts.customerId) {
    const { data: prev } = await supabaseAdmin
      .from("reservation_upsells")
      .select("upsell_item_id")
      .eq("organization_id", opts.organizationId)
      // No podemos filtrar por customer_id directamente, usamos reservation join
      .neq("status", "CANCELLED");
    previousUpsells = (prev || []).map((u: any) => u.upsell_item_id);
  }

  const hour = opts.date.getHours();
  const month = opts.date.getMonth();

  const recommendations: UpsellRecommendation[] = [];

  for (const item of items) {
    let score = 50;
    const reasons: string[] = [];

    // Score por categoría
    switch (item.category) {
      case 'WINE':
        score += 20;
        if (customer?.favorite_wine) {
          score += 25;
          reasons.push('Vino favorito del cliente');
        }
        if (opts.partySize >= 4) {
          score += 15;
          reasons.push('Ideal para grupos');
        }
        break;
      case 'MENU':
      case 'TASTING':
        if (opts.partySize >= 2) {
          score += 20;
          reasons.push('Experiencia para compartir');
        }
        if (customer?.avg_ticket && customer.avg_ticket > 50) {
          score += 15;
          reasons.push('Cliente de alto gasto');
        }
        break;
      case 'BIRTHDAY':
        // Verificar si es cumpleaños del cliente
        if (customer?.birthday) {
          const bd = new Date(customer.birthday);
          if (bd.getMonth() === month && Math.abs(bd.getDate() - opts.date.getDate()) <= 7) {
            score += 50;
            reasons.push('¡Cumpleaños del cliente!');
          }
        }
        break;
      case 'PARKING':
        if (hour >= 19) { // Cena
          score += 10;
          reasons.push('Conveniente para cena');
        }
        break;
      case 'DECORATION':
        if (opts.partySize >= 4) {
          score += 15;
          reasons.push('Decoración para grupos');
        }
        break;
      case 'EXPERIENCE':
        if (customer?.loyalty_tier === 'PLATINUM' || customer?.loyalty_tier === 'DIAMOND') {
          score += 30;
          reasons.push('Experiencia premium para cliente VIP');
        }
        break;
    }

    // Si ya lo compró antes, darle boost (le gustó)
    if (previousUpsells.includes(item.id)) {
      score += 10;
      reasons.push('Comprado anteriormente');
    }

    // Alergias: penalizar items que puedan contener alérgenos
    // (simplificado: si el cliente tiene alergias y el item es comida)
    if (customer?.allergies?.length > 0 && ['MENU', 'TASTING'].includes(item.category)) {
      score -= 10;
      reasons.push('Verificar alergias');
    }

    recommendations.push({
      upsell_item_id: item.id,
      name: item.name,
      description: item.description,
      price: Number(item.price),
      image_url: item.image_url,
      category: item.category,
      score: Math.min(100, score),
      reason: reasons.join('; ') || 'Recomendado para tu reserva',
    });
  }

  // Ordenar por score y devolver top 5
  return recommendations.sort((a, b) => b.score - a.score).slice(0, 5);
}
