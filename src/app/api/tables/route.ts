import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { checkLimit } from '@/lib/stripe'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Multi-tenant: organizationId always enforced.
  const tables = await db.table.list(user.organizationId)

  // Fetch upcoming reservations per table (next 24h, active states).
  const { supabaseAdmin } = await import('@/lib/supabase/admin')
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data: reservationsByTable } = await supabaseAdmin
    .from('reservations')
    .select('id, customer_name, phone, party_size, date, status, shift, zone, table_id')
    .eq('organization_id', user.organizationId)
    .in('status', ['CONFIRMED', 'PENDING', 'SEATED'])
    .gte('date', since)
    .order('date', { ascending: true })

  const reservationsMap = new Map<string, any[]>()
  for (const r of reservationsByTable || []) {
    if (!r.table_id) continue
    const list = reservationsMap.get(r.table_id) || []
    list.push(r)
    reservationsMap.set(r.table_id, list)
  }

  // Also fetch active orders per table.
  // Bounded by .limit(200) — a tenant's concurrent active orders never
  // exceeds 200 in practice (one per table), and without a limit this
  // query would grow with the tenant's order history.
  const { data: activeOrders } = await supabaseAdmin
    .from('orders')
    .select('id, status, table_id')
    .eq('organization_id', user.organizationId)
    .in('status', ['PENDING', 'PREPARING', 'SERVED'])
    .limit(200)

  const ordersMap = new Map<string, any>()
  for (const o of activeOrders || []) {
    if (o.table_id && !ordersMap.has(o.table_id)) ordersMap.set(o.table_id, o)
  }

  return NextResponse.json(
    tables.map((t) => ({
      ...t,
      posX: t.pos_x,
      posY: t.pos_y,
      organizationId: t.organization_id,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      reservations: reservationsMap.get(t.id) || [],
      orders: ordersMap.has(t.id) ? [ordersMap.get(t.id)] : [],
    }))
  )
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { number, name, capacity, zone, shape, posX, posY } = body
  if (!number || !number.trim())
    return NextResponse.json({ error: 'Número obligatorio' }, { status: 400 })

  // ─── Plan limit enforcement ────────────────────────────────
  // Starter (15 tables max), Professional (50), Enterprise (unlimited).
  // Without this check, a Starter user could create unlimited tables.
  const limit = await checkLimit(user.organizationId, 'tables')
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Has alcanzado el límite de mesas de tu plan (${limit.limit}). Mejora tu plan para crear más mesas.`,
        limit: limit.limit,
        current: limit.current,
      },
      { status: 402 }
    )
  }

  const existing = await db.table.findFirst(user.organizationId, { number: number.trim() })
  if (existing) return NextResponse.json({ error: 'Ya existe una mesa con ese número' }, { status: 409 })

  const table = await db.table.create({
    number: number.trim(),
    name: name || null,
    capacity: typeof capacity === 'number' ? capacity : 4,
    zone: zone || 'INTERIOR',
    shape: shape || 'SQUARE',
    pos_x: typeof posX === 'number' ? posX : 0,
    pos_y: typeof posY === 'number' ? posY : 0,
    status: 'AVAILABLE',
    organization_id: user.organizationId,
  })
  return NextResponse.json({
    ...table,
    posX: table.pos_x,
    posY: table.pos_y,
    organizationId: table.organization_id,
    createdAt: table.created_at,
    updatedAt: table.updated_at,
  }, { status: 201 })
}
