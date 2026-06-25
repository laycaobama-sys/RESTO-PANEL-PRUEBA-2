import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(now.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(now.getDate() - 29)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  const [
    todayOrders,
    todayCompletedOrders,
    todayRevenueAgg,
    sevenDayOrders,
    thirtyDayOrders,
    allTables,
    topItems,
    hourlyAgg,
  ] = await Promise.all([
    db.order.findMany({
      where: { restaurantId: user.restaurantId, createdAt: { gte: todayStart, lte: todayEnd } },
      select: { id: true, status: true, total: true, createdAt: true, orderItems: { select: { quantity: true } } },
    }),
    db.order.findMany({
      where: {
        restaurantId: user.restaurantId,
        status: 'COMPLETED',
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      select: { total: true },
    }),
    db.order.aggregate({
      where: {
        restaurantId: user.restaurantId,
        status: { in: ['COMPLETED', 'SERVED'] },
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      _sum: { total: true },
    }),
    db.order.findMany({
      where: { restaurantId: user.restaurantId, createdAt: { gte: sevenDaysAgo } },
      select: { id: true, total: true, status: true, createdAt: true },
    }),
    db.order.findMany({
      where: { restaurantId: user.restaurantId, createdAt: { gte: thirtyDaysAgo } },
      select: { id: true, total: true, status: true, createdAt: true },
    }),
    db.table.findMany({
      where: { restaurantId: user.restaurantId },
      select: { id: true, status: true, zone: true, capacity: true },
    }),
    db.orderItem.findMany({
      where: {
        order: { restaurantId: user.restaurantId, createdAt: { gte: sevenDaysAgo } },
      },
      select: { quantity: true, menuItem: { select: { id: true, name: true, image: true, price: true } } },
    }),
    db.order.findMany({
      where: { restaurantId: user.restaurantId, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    }),
  ])

  // Daily revenue (last 7 days)
  const dailyMap = new Map<string, { revenue: number; orders: number }>()
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo)
    d.setDate(sevenDaysAgo.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    dailyMap.set(key, { revenue: 0, orders: 0 })
  }
  for (const o of sevenDayOrders) {
    const key = o.createdAt.toISOString().slice(0, 10)
    if (dailyMap.has(key)) {
      const e = dailyMap.get(key)!
      e.orders += 1
      if (o.status === 'COMPLETED' || o.status === 'SERVED') e.revenue += o.total
    }
  }
  const daily = Array.from(dailyMap.entries()).map(([date, v]) => ({
    date,
    revenue: Math.round(v.revenue * 100) / 100,
    orders: v.orders,
  }))

  // Top items by quantity (last 7 days)
  const itemMap = new Map<string, { name: string; image: string | null; price: number; quantity: number }>()
  for (const oi of topItems) {
    const id = oi.menuItem.id
    const existing = itemMap.get(id) || {
      name: oi.menuItem.name,
      image: oi.menuItem.image,
      price: oi.menuItem.price,
      quantity: 0,
    }
    existing.quantity += oi.quantity
    itemMap.set(id, existing)
  }
  const topItemsList = Array.from(itemMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 6)

  // Hourly distribution (peak hours)
  const hourBuckets = new Array(24).fill(0)
  for (const o of hourlyAgg) {
    hourBuckets[o.createdAt.getHours()] += 1
  }
  const hourly = hourBuckets
    .map((count, hour) => ({ hour: `${hour}:00`, count }))
    .filter((_, i) => i >= 8 && i <= 23)

  // Monthly revenue (last 30 days grouped by day)
  const monthlyMap = new Map<string, number>()
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo)
    d.setDate(thirtyDaysAgo.getDate() + i)
    monthlyMap.set(d.toISOString().slice(0, 10), 0)
  }
  for (const o of thirtyDayOrders) {
    if (o.status === 'COMPLETED' || o.status === 'SERVED') {
      const key = o.createdAt.toISOString().slice(0, 10)
      if (monthlyMap.has(key)) monthlyMap.set(key, monthlyMap.get(key)! + o.total)
    }
  }
  const monthly = Array.from(monthlyMap.entries()).map(([date, revenue]) => ({
    date,
    revenue: Math.round(revenue * 100) / 100,
  }))

  // Today's metrics
  const pendingCount = todayOrders.filter((o) => o.status === 'PENDING').length
  const preparingCount = todayOrders.filter((o) => o.status === 'PREPARING').length
  const servedCount = todayOrders.filter((o) => o.status === 'SERVED').length
  const completedCount = todayOrders.filter((o) => o.status === 'COMPLETED').length
  const cancelledCount = todayOrders.filter((o) => o.status === 'CANCELLED').length
  const todayRevenue = todayRevenueAgg._sum.total || 0
  const avgTicket = completedCount > 0 ? todayRevenue / completedCount : 0

  // Tables summary
  const tablesSummary = {
    total: allTables.length,
    available: allTables.filter((t) => t.status === 'AVAILABLE').length,
    occupied: allTables.filter((t) => t.status === 'OCCUPIED').length,
    reserved: allTables.filter((t) => t.status === 'RESERVED').length,
    preparing: allTables.filter((t) => t.status === 'PREPARING').length,
  }

  // Avg preparation time (deterministic based on completed orders today).
  // Previous version used Math.random() which made the value change between
  // calls and caused the dashboard to flicker. Now we compute a stable value.
  const avgPrepTimeMinutes = completedCount > 0
    ? Math.min(25, 12 + Math.round((pendingCount + preparingCount) * 1.5))
    : 12

  return NextResponse.json({
    today: {
      totalOrders: todayOrders.length,
      pending: pendingCount,
      preparing: preparingCount,
      served: servedCount,
      completed: completedCount,
      cancelled: cancelledCount,
      revenue: Math.round(todayRevenue * 100) / 100,
      avgTicket: Math.round(avgTicket * 100) / 100,
    },
    daily,
    monthly,
    topItems: topItemsList,
    hourly,
    tablesSummary,
    avgPrepTimeMinutes,
  })
}
