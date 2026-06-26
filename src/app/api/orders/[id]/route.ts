import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

const NEXT_STATUS: Record<string, string> = {
  PENDING: 'PREPARING',
  PREPARING: 'SERVED',
  SERVED: 'COMPLETED',
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const { status, action } = body as { status?: string; action?: 'advance' | 'cancel' }

  const existing = await db.order.findById(id, user.organizationId)
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  let newStatus = existing.status
  if (action === 'cancel') newStatus = 'CANCELLED'
  else if (status && ['PENDING', 'PREPARING', 'SERVED', 'COMPLETED', 'CANCELLED'].includes(status)) {
    newStatus = status
  } else if (action === 'advance') {
    newStatus = NEXT_STATUS[existing.status] || existing.status
  }

  const updated = await db.order.update(id, user.organizationId, { status: newStatus })

  if (existing.table_id) {
    const tableStatus =
      newStatus === 'COMPLETED' || newStatus === 'CANCELLED'
        ? 'AVAILABLE'
        : newStatus === 'PREPARING'
        ? 'PREPARING'
        : 'OCCUPIED'
    await db.table.update(existing.table_id, user.organizationId, { status: tableStatus })
  }

  // Fetch enriched order for the response
  const [items, table] = await Promise.all([
    db.order.listItems(updated.id, user.organizationId),
    updated.table_id ? db.table.findFirst(user.organizationId, { id: updated.table_id }) : Promise.resolve(null),
  ])
  const menuItemIds = items.map((i) => i.menu_item_id)
  const menuItems = await db.menuItem.findManyByIds(menuItemIds, user.organizationId)
  const itemMap = new Map(menuItems.map((m) => [m.id, m]))
  return NextResponse.json({
    ...updated,
    orderType: updated.order_type,
    tableId: updated.table_id,
    organizationId: updated.organization_id,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
    table,
    orderItems: items.map((i) => ({ ...i, menuItem: itemMap.get(i.menu_item_id) || null })),
  })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const order = await db.order.findById(id, user.organizationId)
  if (!order) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const [items, table] = await Promise.all([
    db.order.listItems(order.id, user.organizationId),
    order.table_id ? db.table.findFirst(user.organizationId, { id: order.table_id }) : Promise.resolve(null),
  ])
  const menuItemIds = items.map((i) => i.menu_item_id)
  const menuItems = await db.menuItem.findManyByIds(menuItemIds, user.organizationId)
  const itemMap = new Map(menuItems.map((m) => [m.id, m]))
  return NextResponse.json({
    ...order,
    orderType: order.order_type,
    tableId: order.table_id,
    organizationId: order.organization_id,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    table,
    orderItems: items.map((i) => ({ ...i, menuItem: itemMap.get(i.menu_item_id) || null })),
  })
}
