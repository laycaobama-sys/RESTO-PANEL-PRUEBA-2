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

  // Fetch order items + tables in parallel for each order.
  const enriched = await Promise.all(
    orders.map(async (o) => {
      const [items, table] = await Promise.all([
        db.order.listItems(o.id, user.organizationId),
        o.table_id
          ? db.table.findFirst(user.organizationId, { id: o.table_id })
          : Promise.resolve(null),
      ])
      const menuItemIds = items.map((i) => i.menu_item_id)
      const menuItems = await db.menuItem.findManyByIds(menuItemIds, user.organizationId)
      const itemMap = new Map(menuItems.map((m) => [m.id, m]))
      return {
        ...o,
        orderType: o.order_type,
        tableId: o.table_id,
        organizationId: o.organization_id,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
        table,
        orderItems: items.map((i) => ({
          ...i,
          menuItem: itemMap.get(i.menu_item_id) || null,
        })),
      }
    })
  )
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
  let tableObj = null
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
