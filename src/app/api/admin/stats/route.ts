import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

// Super-admin only: returns aggregated KPIs + chart datasets + ranking + alerts.
// All queries bypass RLS via the service_role client and are scoped globally.
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const range = url.searchParams.get('range') || '30' // days

  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const yesterdayEnd = new Date(todayEnd); yesterdayEnd.setDate(yesterdayEnd.getDate() - 1)
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
  const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30)
  const rangeStart = new Date(now); rangeStart.setDate(rangeStart.getDate() - Number(range))

  // Parallel queries: counts, time-series, ranking, alerts.
  const [
    tenantsAll, tenantsActive, tenantsSuspended, tenantsPending,
    usersAll, superAdmins,
    reservationsToday, reservationsYesterday, reservationsLastWeek, reservationsLastMonth, reservationsRange,
    reservationsConfirmed, reservationsPending, reservationsCancelled, reservationsNoShow,
    reservationsLunch, reservationsDinner,
    ordersToday, ordersYesterday,
    revenueToday, revenueYesterday,
    menuItems, tables, orders, auditLogs,
    reservationsRangeList, ordersRangeList,
    reservationsByZone,
  ] = await Promise.all([
    supabaseAdmin.from('organizations').select('id, status, name, slug, created_at', { count: 'exact', head: false }),
    supabaseAdmin.from('organizations').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
    supabaseAdmin.from('organizations').select('id', { count: 'exact', head: true }).eq('status', 'SUSPENDED'),
    supabaseAdmin.from('organizations').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
    supabaseAdmin.from('users').select('id, is_super_admin, created_at', { count: 'exact', head: false }),
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('is_super_admin', true),
    // Reservations per period
    supabaseAdmin.from('reservations').select('party_size', { count: 'exact', head: false }).gte('date', todayStart.toISOString()).lte('date', todayEnd.toISOString()),
    supabaseAdmin.from('reservations').select('party_size', { count: 'exact', head: false }).gte('date', yesterdayStart.toISOString()).lte('date', yesterdayEnd.toISOString()),
    supabaseAdmin.from('reservations').select('id', { count: 'exact', head: true }).gte('date', weekAgo.toISOString()),
    supabaseAdmin.from('reservations').select('id', { count: 'exact', head: true }).gte('date', monthAgo.toISOString()),
    supabaseAdmin.from('reservations').select('id, date, status, shift, zone, party_size, organization_id', { count: 'exact', head: false }).gte('date', rangeStart.toISOString()),
    // Status distribution (last 30d)
    supabaseAdmin.from('reservations').select('id', { count: 'exact', head: true }).eq('status', 'CONFIRMED').gte('date', monthAgo.toISOString()),
    supabaseAdmin.from('reservations').select('id', { count: 'exact', head: true }).eq('status', 'PENDING').gte('date', monthAgo.toISOString()),
    supabaseAdmin.from('reservations').select('id', { count: 'exact', head: true }).eq('status', 'CANCELLED').gte('date', monthAgo.toISOString()),
    supabaseAdmin.from('reservations').select('id', { count: 'exact', head: true }).eq('status', 'NO_SHOW').gte('date', monthAgo.toISOString()),
    // Shift distribution
    supabaseAdmin.from('reservations').select('id', { count: 'exact', head: true }).eq('shift', 'LUNCH').gte('date', monthAgo.toISOString()),
    supabaseAdmin.from('reservations').select('id', { count: 'exact', head: true }).eq('shift', 'DINNER').gte('date', monthAgo.toISOString()),
    // Orders today vs yesterday
    supabaseAdmin.from('orders').select('total', { count: 'exact', head: false }).gte('created_at', todayStart.toISOString()).lte('created_at', todayEnd.toISOString()),
    supabaseAdmin.from('orders').select('total', { count: 'exact', head: false }).gte('created_at', yesterdayStart.toISOString()).lte('created_at', yesterdayEnd.toISOString()),
    // Revenue today vs yesterday (sum of completed/served orders)
    supabaseAdmin.from('orders').select('total').in('status', ['COMPLETED', 'SERVED']).gte('created_at', todayStart.toISOString()).lte('created_at', todayEnd.toISOString()),
    supabaseAdmin.from('orders').select('total').in('status', ['COMPLETED', 'SERVED']).gte('created_at', yesterdayStart.toISOString()).lte('created_at', yesterdayEnd.toISOString()),
    // Catalog totals
    supabaseAdmin.from('menu_items').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('tables').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('audit_logs').select('id', { count: 'exact', head: true }),
    // Range lists (for time-series charts + ranking)
    supabaseAdmin.from('reservations').select('date, status, shift, zone, party_size, organization_id').gte('date', rangeStart.toISOString()),
    supabaseAdmin.from('orders').select('total, status, created_at, organization_id').gte('created_at', rangeStart.toISOString()),
    supabaseAdmin.from('reservations').select('zone', { count: 'exact', head: false }).gte('date', monthAgo.toISOString()),
  ])

  // ─── KPI deltas (today vs yesterday) ───────────────────────────
  const reservationsTodayCount = reservationsToday.count || 0
  const reservationsYesterdayCount = reservationsYesterday.count || 0
  const ordersTodayCount = ordersToday.count || 0
  const ordersYesterdayCount = ordersYesterday.count || 0
  const revenueTodaySum = (revenueToday.data || []).reduce((s: number, o: any) => s + Number(o.total), 0)
  const revenueYesterdaySum = (revenueYesterday.data || []).reduce((s: number, o: any) => s + Number(o.total), 0)
  const paxToday = (reservationsToday.data || []).reduce((s: number, r: any) => s + r.party_size, 0)
  const paxYesterday = (reservationsYesterday.data || []).reduce((s: number, r: any) => s + r.party_size, 0)

  const delta = (curr: number, prev: number): number => {
    if (prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 100)
  }

  // ─── Time-series: reservations per day ─────────────────────────
  const days = Number(range)
  const reservationsByDay = new Map<string, { date: string; total: number; confirmed: number; cancelled: number }>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
    const key = d.toISOString().slice(0, 10)
    reservationsByDay.set(key, { date: key, total: 0, confirmed: 0, cancelled: 0 })
  }
  for (const r of (reservationsRangeList.data || []) as any[]) {
    const key = new Date(r.date).toISOString().slice(0, 10)
    if (reservationsByDay.has(key)) {
      const e = reservationsByDay.get(key)!
      e.total += 1
      if (r.status === 'CONFIRMED' || r.status === 'SEATED' || r.status === 'COMPLETED') e.confirmed += 1
      if (r.status === 'CANCELLED' || r.status === 'NO_SHOW') e.cancelled += 1
    }
  }
  const timeSeries = Array.from(reservationsByDay.values())

  // ─── Time-series: revenue per day ──────────────────────────────
  const revenueByDay = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
    revenueByDay.set(d.toISOString().slice(0, 10), 0)
  }
  for (const o of (ordersRangeList.data || []) as any[]) {
    if (o.status !== 'COMPLETED' && o.status !== 'SERVED') continue
    const key = new Date(o.created_at).toISOString().slice(0, 10)
    if (revenueByDay.has(key)) revenueByDay.set(key, revenueByDay.get(key)! + Number(o.total))
  }
  const revenueSeries = Array.from(revenueByDay.entries()).map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }))

  // ─── Ranking: top restaurants by reservations (range) ─────────
  const orgMap = new Map<string, { id: string; name: string; slug: string; status: string }>()
  for (const t of (tenantsAll.data || []) as any[]) {
    orgMap.set(t.id, { id: t.id, name: t.name, slug: t.slug, status: t.status })
  }
  const rankingMap = new Map<string, { organization: any; reservations: number; revenue: number; cancelRate: number; pax: number; cancelled: number }>()
  for (const t of orgMap.values()) {
    rankingMap.set(t.id, { organization: t, reservations: 0, revenue: 0, cancelRate: 0, pax: 0, cancelled: 0 })
  }
  for (const r of (reservationsRangeList.data || []) as any[]) {
    const e = rankingMap.get(r.organization_id)
    if (!e) continue
    e.reservations += 1
    e.pax += r.party_size || 0
    if (r.status === 'CANCELLED' || r.status === 'NO_SHOW') e.cancelled += 1
  }
  for (const o of (ordersRangeList.data || []) as any[]) {
    const e = rankingMap.get(o.organization_id)
    if (!e) continue
    if (o.status === 'COMPLETED' || o.status === 'SERVED') e.revenue += Number(o.total)
  }
  const ranking = Array.from(rankingMap.values())
    .filter(r => r.reservations > 0 || r.revenue > 0)
    .map(r => ({ ...r, cancelRate: r.reservations > 0 ? Math.round((r.cancelled / r.reservations) * 100) : 0 }))
    .sort((a, b) => b.reservations - a.reservations)
    .slice(0, 10)

  // ─── Alerts: restaurants with problems ────────────────────────
  const alerts: Array<{ type: string; severity: 'warning' | 'critical' | 'info'; message: string; tenantId?: string; tenantName?: string }> = []

  // Suspended tenants
  for (const t of (tenantsAll.data || []) as any[]) {
    if (t.status === 'SUSPENDED') {
      alerts.push({ type: 'TENANT_SUSPENDED', severity: 'warning', message: `Empresa suspendida`, tenantId: t.id, tenantName: t.name })
    }
    if (t.status === 'PENDING') {
      alerts.push({ type: 'TENANT_PENDING', severity: 'info', message: `Empresa pendiente de activación`, tenantId: t.id, tenantName: t.name })
    }
  }
  // Tenants with high cancellation rate (>30%)
  for (const r of ranking) {
    if (r.cancelRate >= 30) {
      alerts.push({
        type: 'HIGH_CANCEL_RATE', severity: r.cancelRate >= 50 ? 'critical' : 'warning',
        message: `Tasa de cancelación alta (${r.cancelRate}%)`,
        tenantId: r.organization.id, tenantName: r.organization.name,
      })
    }
  }
  // Tenants with no reservations in range
  for (const t of orgMap.values()) {
    if (t.status === 'ACTIVE' && !rankingMap.get(t.id)?.reservations) {
      alerts.push({
        type: 'NO_RESERVATIONS', severity: 'info',
        message: `Sin reservas en los últimos ${range} días`,
        tenantId: t.id, tenantName: t.name,
      })
    }
  }

  // ─── Zone distribution ────────────────────────────────────────
  const zoneCount = { INTERIOR: 0, TERRACE: 0, BAR: 0, VIP: 0 }
  for (const r of (reservationsByZone.data || []) as any[]) {
    if (r.zone && zoneCount[r.zone as keyof typeof zoneCount] !== undefined) {
      zoneCount[r.zone as keyof typeof zoneCount] += 1
    }
  }

  // ─── Occupancy by shift ───────────────────────────────────────
  const shiftDistribution = [
    { name: 'Comida', value: reservationsLunch.count || 0, color: '#FF6B35' },
    { name: 'Cena', value: reservationsDinner.count || 0, color: '#0EA5E9' },
  ]

  // ─── Status distribution ──────────────────────────────────────
  const statusDistribution = [
    { name: 'Confirmadas', value: reservationsConfirmed.count || 0, color: '#16a34a' },
    { name: 'Pendientes', value: reservationsPending.count || 0, color: '#eab308' },
    { name: 'Canceladas', value: reservationsCancelled.count || 0, color: '#ef4444' },
    { name: 'No-show', value: reservationsNoShow.count || 0, color: '#a855f7' },
  ]

  return NextResponse.json({
    kpis: {
      tenants: {
        total: tenantsAll.count || 0,
        active: tenantsActive.count || 0,
        suspended: tenantsSuspended.count || 0,
        pending: tenantsPending.count || 0,
      },
      users: {
        total: usersAll.count || 0,
        superAdmins: superAdmins.count || 0,
      },
      reservations: {
        today: reservationsTodayCount,
        yesterday: reservationsYesterdayCount,
        lastWeek: reservationsLastWeek.count || 0,
        lastMonth: reservationsLastMonth.count || 0,
        todayPax: paxToday,
        delta: delta(reservationsTodayCount, reservationsYesterdayCount),
      },
      orders: {
        today: ordersTodayCount,
        yesterday: ordersYesterdayCount,
        total: orders.count || 0,
        delta: delta(ordersTodayCount, ordersYesterdayCount),
      },
      revenue: {
        today: Math.round(revenueTodaySum * 100) / 100,
        yesterday: Math.round(revenueYesterdaySum * 100) / 100,
        delta: delta(revenueTodaySum, revenueYesterdaySum),
      },
      catalog: {
        menuItems: menuItems.count || 0,
        tables: tables.count || 0,
        auditLogs: auditLogs.count || 0,
      },
      paxDelta: delta(paxToday, paxYesterday),
    },
    timeSeries,
    revenueSeries,
    ranking,
    alerts,
    statusDistribution,
    shiftDistribution,
    zoneDistribution: Object.entries(zoneCount).map(([name, value]) => ({ name, value })),
  })
}
