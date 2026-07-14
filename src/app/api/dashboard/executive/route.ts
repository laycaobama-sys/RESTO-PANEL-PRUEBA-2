import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const orgId = user.organizationId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  // KPIs en paralelo
  const [
    reservationsToday,
    completedToday,
    noShowsToday,
    cancellationsToday,
    vipCustomersToday,
    birthdaysToday,
    waitlistStats,
    revenueToday,
    coversToday,
    newCustomersThisMonth,
    recurringCustomers,
    reservationsByChannel,
    avgStayToday,
    upsellsRevenueToday,
  ] = await Promise.all([
    // Reservas totales hoy
    supabaseAdmin.from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["CONFIRMED","PENDING","SEATED"])
      .gte("date", todayStr),
    // Completadas hoy
    supabaseAdmin.from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "COMPLETED")
      .gte("date", todayStr),
    // No-shows hoy
    supabaseAdmin.from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "NO_SHOW")
      .gte("date", todayStr),
    // Cancelaciones hoy
    supabaseAdmin.from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "CANCELLED")
      .gte("date", todayStr),
    // Clientes VIP con reserva hoy
    supabaseAdmin.from("reservations")
      .select("customer_id, customers(vip_status)")
      .eq("organization_id", orgId)
      .in("status", ["CONFIRMED","PENDING","SEATED"])
      .gte("date", todayStr),
    // Cumpleaños hoy
    supabaseAdmin.from("customers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("extract(month from birthday)::int", today.getMonth() + 1)
      .eq("extract(day from birthday)::int", today.getDate()),
    // Waitlist
    supabaseAdmin.from("waitlist")
      .select("status")
      .eq("organization_id", orgId)
      .gte("created_at", todayStr),
    // Revenue hoy
    supabaseAdmin.from("reservations")
      .select("estimated_revenue")
      .eq("organization_id", orgId)
      .eq("status", "COMPLETED")
      .gte("date", todayStr),
    // Covers hoy
    supabaseAdmin.from("reservations")
      .select("party_size")
      .eq("organization_id", orgId)
      .eq("status", "COMPLETED")
      .gte("date", todayStr),
    // Nuevos clientes este mes
    supabaseAdmin.from("customers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", new Date(today.getFullYear(), today.getMonth(), 1).toISOString()),
    // Recurrentes (visits_count > 1)
    supabaseAdmin.from("customers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("visits_count", 2),
    // Por canal
    supabaseAdmin.from("reservations")
      .select("source_channel")
      .eq("organization_id", orgId)
      .gte("date", todayStr),
    // Estancia media hoy
    supabaseAdmin.from("reservations")
      .select("created_at, updated_at")
      .eq("organization_id", orgId)
      .eq("status", "COMPLETED")
      .gte("date", todayStr),
    // Revenue upsell hoy
    supabaseAdmin.from("reservation_upsells")
      .select("total_price")
      .eq("organization_id", orgId)
      .neq("status", "CANCELLED")
      .gte("created_at", todayStr),
  ]);

  // Calcular ingresos
  const revenue = (revenueToday.data || []).reduce(
    (s: number, r: any) => s + Number(r.estimated_revenue || 0), 0
  );
  const covers = (coversToday.data || []).reduce(
    (s: number, r: any) => s + Number(r.party_size || 0), 0
  );
  const upsellRev = (upsellsRevenueToday.data || []).reduce(
    (s: number, r: any) => s + Number(r.total_price || 0), 0
  );

  // Contar VIPs
  const vipCount = (vipCustomersToday.data || []).filter((r: any) => r.customers?.vip_status).length;

  // Canales
  const channelCounts: Record<string, number> = {};
  for (const r of (reservationsByChannel.data || []) as any[]) {
    const ch = r.source_channel || "unknown";
    channelCounts[ch] = (channelCounts[ch] || 0) + 1;
  }

  // Estancia media (minutos)
  const stayTimes = (avgStayToday.data || []).map((r: any) =>
    (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / 60000
  ).filter((m: number) => m > 0 && m < 600);
  const avgStay = stayTimes.length > 0
    ? Math.round(stayTimes.reduce((a: number, b: number) => a + b, 0) / stayTimes.length)
    : 0;

  // Waitlist stats
  const wl = waitlistStats.data || [];
  const waitlistWaiting = wl.filter((w: any) => w.status === "WAITING").length;
  const waitlistSeated = wl.filter((w: any) => w.status === "SEATED").length;

  // Mesas libres
  const { count: freeTables } = await supabaseAdmin
    .from("tables")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "AVAILABLE")
    .eq("blocked", false);

  const { count: blockedTables } = await supabaseAdmin
    .from("tables")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("blocked", true);

  return NextResponse.json({
    date: today.toISOString(),
    reservations: {
      today: reservationsToday.count || 0,
      completed: completedToday.count || 0,
      no_shows: noShowsToday.count || 0,
      cancelled: cancellationsToday.count || 0,
    },
    revenue: {
      today: Number(revenue.toFixed(2)),
      upsells: Number(upsellRev.toFixed(2)),
      total: Number((revenue + upsellRev).toFixed(2)),
    },
    covers: covers,
    avg_stay_min: avgStay,
    customers: {
      vip_today: vipCount,
      birthdays_today: birthdaysToday.count || 0,
      new_this_month: newCustomersThisMonth.count || 0,
      recurring: recurringCustomers.count || 0,
    },
    channels: channelCounts,
    tables: {
      free: freeTables || 0,
      blocked: blockedTables || 0,
    },
    waitlist: {
      waiting: waitlistWaiting,
      seated: waitlistSeated,
    },
  });
}
