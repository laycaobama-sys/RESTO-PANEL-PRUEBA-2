import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

// GET /api/admin/tenants/[id]/details — full detail of a tenant with metrics
// for the super admin detail panel.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || !user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params

  const now = new Date()
  const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30)

  const [org, settings, users, categories, menuItems, tables, reservationsRange, ordersRange, recentReservations, recentOrders] = await Promise.all([
    supabaseAdmin.from('organizations').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin.from('organization_settings').select('*').eq('organization_id', id).maybeSingle(),
    supabaseAdmin.from('users').select('id, email, name, role, is_super_admin, created_at').eq('organization_id', id).order('created_at', { ascending: true }),
    supabaseAdmin.from('categories').select('id, name, slug, visible, sort_order').eq('organization_id', id).order('sort_order', { ascending: true }),
    supabaseAdmin.from('menu_items').select('id, name, price, available, visible, category_id').eq('organization_id', id),
    supabaseAdmin.from('tables').select('id, number, name, capacity, zone, shape, status, pos_x, pos_y').eq('organization_id', id).order('zone', { ascending: true }),
    // Last 30d reservations for charts
    supabaseAdmin.from('reservations').select('date, status, shift, zone, party_size').eq('organization_id', id).gte('date', monthAgo.toISOString()),
    // Last 30d orders
    supabaseAdmin.from('orders').select('total, status, created_at').eq('organization_id', id).gte('created_at', monthAgo.toISOString()),
    // Recent 10 reservations
    supabaseAdmin.from('reservations').select('id, customer_name, phone, party_size, date, status, shift, zone, table_id').eq('organization_id', id).order('date', { ascending: false }).limit(10),
    // Recent 10 orders
    supabaseAdmin.from('orders').select('id, number, status, total, created_at, table_id').eq('organization_id', id).order('created_at', { ascending: false }).limit(10),
  ])

  if (!org.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Build time series for reservations (last 30 days)
  const days = 30
  const reservationsByDay = new Map<string, { date: string; total: number; confirmed: number; cancelled: number }>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
    const key = d.toISOString().slice(0, 10)
    reservationsByDay.set(key, { date: key, total: 0, confirmed: 0, cancelled: 0 })
  }
  for (const r of (reservationsRange.data || []) as any[]) {
    const key = new Date(r.date).toISOString().slice(0, 10)
    if (reservationsByDay.has(key)) {
      const e = reservationsByDay.get(key)!
      e.total += 1
      if (r.status === 'CONFIRMED' || r.status === 'SEATED' || r.status === 'COMPLETED') e.confirmed += 1
      if (r.status === 'CANCELLED' || r.status === 'NO_SHOW') e.cancelled += 1
    }
  }
  const timeSeries = Array.from(reservationsByDay.values())

  // Revenue per day
  const revenueByDay = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
    revenueByDay.set(d.toISOString().slice(0, 10), 0)
  }
  let totalRevenue = 0
  for (const o of (ordersRange.data || []) as any[]) {
    if (o.status !== 'COMPLETED' && o.status !== 'SERVED') continue
    const key = new Date(o.created_at).toISOString().slice(0, 10)
    if (revenueByDay.has(key)) revenueByDay.set(key, revenueByDay.get(key)! + Number(o.total))
    totalRevenue += Number(o.total)
  }
  const revenueSeries = Array.from(revenueByDay.entries()).map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }))

  // Status distribution
  const statusDist = { CONFIRMED: 0, PENDING: 0, CANCELLED: 0, SEATED: 0, COMPLETED: 0, NO_SHOW: 0 }
  for (const r of (reservationsRange.data || []) as any[]) {
    if (statusDist[r.status as keyof typeof statusDist] !== undefined) {
      statusDist[r.status as keyof typeof statusDist] += 1
    }
  }

  // Zone distribution
  const zoneDist = { INTERIOR: 0, TERRACE: 0, BAR: 0, VIP: 0 }
  for (const r of (reservationsRange.data || []) as any[]) {
    if (r.zone && zoneDist[r.zone as keyof typeof zoneDist] !== undefined) {
      zoneDist[r.zone as keyof typeof zoneDist] += 1
    }
  }

  // Table status
  const tableStatus = { AVAILABLE: 0, OCCUPIED: 0, RESERVED: 0, PREPARING: 0 }
  for (const t of (tables.data || []) as any[]) {
    if (tableStatus[t.status as keyof typeof tableStatus] !== undefined) {
      tableStatus[t.status as keyof typeof tableStatus] += 1
    }
  }

  return NextResponse.json({
    organization: org.data,
    settings: settings.data,
    users: users.data || [],
    categories: categories.data || [],
    menuItems: menuItems.data || [],
    tables: (tables.data || []).map((t: any) => ({
      ...t,
      posX: t.pos_x,
      posY: t.pos_y,
    })),
    metrics: {
      reservationsTotal: (reservationsRange.data || []).length,
      ordersTotal: (ordersRange.data || []).length,
      revenue: Math.round(totalRevenue * 100) / 100,
      avgTicket: (ordersRange.data || []).length > 0 ? Math.round((totalRevenue / (ordersRange.data || []).length) * 100) / 100 : 0,
      cancelRate: (reservationsRange.data || []).length > 0
        ? Math.round(((statusDist.CANCELLED + statusDist.NO_SHOW) / (reservationsRange.data || []).length) * 100)
        : 0,
      occupancyRate: tables.data && tables.data.length > 0
        ? Math.round(((tableStatus.OCCUPIED + tableStatus.RESERVED + tableStatus.PREPARING) / tables.data.length) * 100)
        : 0,
    },
    charts: {
      timeSeries,
      revenueSeries,
      statusDistribution: Object.entries(statusDist).map(([name, value]) => ({ name, value })),
      zoneDistribution: Object.entries(zoneDist).map(([name, value]) => ({ name, value })),
      tableStatus: Object.entries(tableStatus).map(([name, value]) => ({ name, value })),
    },
    recent: {
      reservations: recentReservations.data || [],
      orders: ordersRange.data || [],
    },
  })
}
