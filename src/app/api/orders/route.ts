import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const tableId = url.searchParams.get('tableId')
  const limit = Number(url.searchParams.get('limit') || '100')

  // Multi-tenant: organizationId is always enforced by db.orders.list.
  const orders = await db.order.list(user.organizationId, {
    status: status || undefined,
    tableId: tableId || undefined,
    limit,
  })

  // ─── Batched enrichment (avoids N+1) ─────────────────────────
  // Previously this block did Promise.all(orders.map(async (o) => {
  //   db.order.listItems(o.id, ...) + db.table.findFirst(...) +
  //   db.menuItem.findManyByIds(...))). That was 3 queries PER order
  // (3N round-trips for N orders). We now do exactly 3 queries total.
  const { supabaseAdmin } = await import('@/lib/supabase/admin')
  const orderIds = orders.map((o) => o.id)

  // 1. Fetch ALL order_items for ALL orders in ONE query.
  //    Bounded by .limit(2000) — 100 orders × 20 items max ≈ 2000 rows.
  const { data: allItems } = orderIds.length > 0
    ? await supabaseAdmin
        .from('order_items')
        .select('*')
        .eq('organization_id', user.organizationId)
        .in('order_id', orderIds)
        .limit(2000)
    : { data: [] }

  // 2. Fetch ALL tables referenced by orders in ONE query.
  //    Bounded by .limit(200) — bounded by tenant's table count.
  const tableIds = Array.from(
    new Set(orders.map((o) => o.table_id).filter(Boolean) as string[])
  )
  const { data: allTables } = tableIds.length > 0
    ? await supabaseAdmin
        .from('tables')
        .select('*')
        .eq('organization_id', user.organizationId)
        .in('id', tableIds)
        .limit(200)
    : { data: [] }

  // 3. Fetch ALL menu_items referenced by the order_items in ONE query.
  //    Bounded by .limit(500) — bounded by tenant's menu size.
  const menuItemIds = Array.from(
    new Set((allItems || []).map((i: any) => i.menu_item_id).filter(Boolean) as string[])
  )
  const { data: allMenuItems } = menuItemIds.length > 0
    ? await supabaseAdmin
        .from('menu_items')
        .select('*')
        .eq('organization_id', user.organizationId)
        .in('id', menuItemIds)
        .limit(500)
    : { data: [] }

  // Build lookup maps for O(1) access during the synchronous enrichment.
  const itemsByOrder = new Map<string, any[]>()
  for (const item of (allItems || []) as any[]) {
    const list = itemsByOrder.get(item.order_id) || []
    list.push(item)
    itemsByOrder.set(item.order_id, list)
  }
  const tableMap = new Map<string, any>()
  for (const t of (allTables || []) as any[]) tableMap.set(t.id, t)
  const menuItemMap = new Map<string, any>()
  for (const m of (allMenuItems || []) as any[]) menuItemMap.set(m.id, m)

  // Synchronous enrichment — no DB calls inside the .map().
  const enriched = orders.map((o) => {
    const items = itemsByOrder.get(o.id) || []
    return {
      ...o,
      orderType: o.order_type,
      tableId: o.table_id,
      organizationId: o.organization_id,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      table: o.table_id ? tableMap.get(o.table_id) || null : null,
      orderItems: items.map((i) => ({
        ...i,
        menuItem: menuItemMap.get(i.menu_item_id) || null,
      })),
    }
  })
  return NextResponse.json(enriched)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { tableId, orderType, notes, items } = body as {
    tableId?: string
    orderType?: string
    notes?: string
    items: { menuItemId: string; quantity: number; notes?: string }[]
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'Añade al menos un plato' }, { status: 400 })
  }

  // Validate menu items belong to tenant
  const menuItemIds = items.map((i) => i.menuItemId)
  const menuItems = await db.menuItem.findManyByIds(menuItemIds, user.organizationId)
  if (menuItems.length !== menuItemIds.length) {
    return NextResponse.json({ error: 'Plato no válido' }, { status: 400 })
  }
  const priceMap = new Map(menuItems.map((m) => [m.id, Number(m.price)]))
  let total = 0
  for (const item of items) total += (priceMap.get(item.menuItemId) || 0) * (item.quantity || 1)

  // Generate sequential order number
  const lastOrder = await db.order.findFirst(user.organizationId, {})
  const number = (lastOrder?.number || 1000) + 1

  // If tableId provided, validate tenancy
  let tableObj: { id: string; [k: string]: any } | null = null
  if (tableId) {
    tableObj = await db.table.findFirst(user.organizationId, { id: tableId })
    if (!tableObj) return NextResponse.json({ error: 'Mesa no válida' }, { status: 400 })
  }

  const order = await db.order.create(
    {
      number,
      status: 'PENDING',
      order_type: orderType || 'DINE_IN',
      total,
      notes: notes || null,
      table_id: tableId || null,
      organization_id: user.organizationId,
    },
    items.map((i) => ({
      menu_item_id: i.menuItemId,
      quantity: i.quantity || 1,
      unit_price: priceMap.get(i.menuItemId) || 0,
      notes: i.notes || null,
    }))
  )

  // Mark table as occupied
  if (tableObj) {
    await db.table.update(tableObj.id, user.organizationId, { status: 'OCCUPIED' })
  }

  return NextResponse.json(order, { status: 201 })
}
