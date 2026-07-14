import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Customer 360° — timeline cronológico unificado
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;

  // Verificar que el cliente pertenece a la org
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .maybeSingle();
  if (!customer) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  // Cargar todos los eventos en paralelo
  const [
    reservations,
    interactions,
    reviews,
    loyaltyTx,
    campaigns,
    predictions,
    upsells,
  ] = await Promise.all([
    // Reservas
    supabaseAdmin.from("reservations")
      .select("id, date, status, party_size, estimated_revenue, table_id, source_channel")
      .eq("customer_id", id)
      .order("date", { ascending: false }),
    // Interacciones
    supabaseAdmin.from("customer_interactions")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    // Reseñas (si están vinculadas)
    supabaseAdmin.from("google_reviews")
      .select("id, author_name, rating, text, sentiment, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    // Transacciones de fidelización
    supabaseAdmin.from("loyalty_transactions")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    // Campañas recibidas
    supabaseAdmin.from("campaign_recipients")
      .select("campaign_id, status, sent_at, opened_at, clicked_at, campaigns(name, type)")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    // Predicciones
    supabaseAdmin.from("customer_predictions")
      .select("*")
      .eq("customer_id", id)
      .maybeSingle(),
    // Upsells comprados
    supabaseAdmin.from("reservation_upsells")
      .select("id, total_price, status, created_at, upsell_items(name)")
      .eq("organization_id", user.organizationId)
      .in("reservation_id",
        (await supabaseAdmin.from("reservations").select("id").eq("customer_id", id)).data?.map((r: any) => r.id) || []
      )
      .order("created_at", { ascending: false }),
  ]);

  // Construir timeline unificado
  const timeline: Array<{ date: string; type: string; title: string; description: string; metadata?: any }> = [];

  for (const r of (reservations.data || [])) {
    timeline.push({
      date: r.date,
      type: "reservation",
      title: `Reserva ${r.status.toLowerCase()}`,
      description: `${r.party_size} personas${r.estimated_revenue ? ` · €${r.estimated_revenue}` : ""}${r.source_channel ? ` · ${r.source_channel}` : ""}`,
      metadata: r,
    });
  }
  for (const i of (interactions.data || [])) {
    timeline.push({
      date: i.created_at,
      type: "interaction",
      title: i.type,
      description: i.subject || i.body || "",
      metadata: i,
    });
  }
  for (const r of (reviews.data || [])) {
    timeline.push({
      date: r.created_at,
      type: "review",
      title: `Reseña ${r.rating}★ ${r.sentiment || ""}`,
      description: r.text?.slice(0, 100) || "",
      metadata: r,
    });
  }
  for (const lt of (loyaltyTx.data || [])) {
    timeline.push({
      date: lt.created_at,
      type: "loyalty",
      title: `${lt.points > 0 ? "+" : ""}${lt.points} puntos (${lt.type})`,
      description: lt.reason || "",
      metadata: lt,
    });
  }
  for (const c of (campaigns.data || []) as any[]) {
    timeline.push({
      date: c.sent_at || c.created_at,
      type: "campaign",
      title: `Campaña: ${c.campaigns?.[0]?.name || c.campaigns?.name || ""}`,
      description: `${c.campaigns?.[0]?.type || c.campaigns?.type || ""} · ${c.status}`,
      metadata: c,
    });
  }
  for (const u of (upsells.data || []) as any[]) {
    timeline.push({
      date: u.created_at,
      type: "upsell",
      title: `Upsell: ${u.upsell_items?.[0]?.name || u.upsell_items?.name || ""}`,
      description: `€${u.total_price} · ${u.status}`,
      metadata: u,
    });
  }

  // Ordenar por fecha descendente
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({
    customer,
    predictions: predictions.data,
    timeline,
    stats: {
      total_reservations: (reservations.data || []).length,
      total_interactions: (interactions.data || []).length,
      total_reviews: (reviews.data || []).length,
      total_loyalty_tx: (loyaltyTx.data || []).length,
      total_campaigns: (campaigns.data || []).length,
      total_upsells: (upsells.data || []).length,
    },
  });
}
