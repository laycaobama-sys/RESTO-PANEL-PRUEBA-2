import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

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

  // Also fetch active orders per table
  const { data: activeOrders } = await supabaseAdmin
    .from('orders')
    .select('id, status, table_id')
    .eq('organization_id', user.organizationId)
    .in('status', ['PENDING', 'PREPARING', 'SERVED'])

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
