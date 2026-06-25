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

  const orders = await db.order.findMany({
    where: {
      restaurantId: user.restaurantId,
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(tableId ? { tableId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      table: true,
      orderItems: { include: { menuItem: true } },
    },
  })
  return NextResponse.json(orders)
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

  // Validate menu items belong to restaurant
  const menuItemIds = items.map((i) => i.menuItemId)
  const menuItems = await db.menuItem.findMany({
    where: { id: { in: menuItemIds }, restaurantId: user.restaurantId },
  })
  if (menuItems.length !== menuItemIds.length) {
    return NextResponse.json({ error: 'Plato no válido' }, { status: 400 })
  }

  const priceMap = new Map(menuItems.map((m) => [m.id, m.price]))
  let total = 0
  for (const item of items) {
    total += (priceMap.get(item.menuItemId) || 0) * (item.quantity || 1)
  }

  // Generate sequential order number
  const lastOrder = await db.order.findFirst({
    where: { restaurantId: user.restaurantId },
    orderBy: { number: 'desc' },
  })
  const number = (lastOrder?.number || 1000) + 1

  const order = await db.order.create({
    data: {
      number,
      status: 'PENDING',
      orderType: orderType || 'DINE_IN',
      total,
      notes: notes || null,
      tableId: tableId || null,
      restaurantId: user.restaurantId,
      orderItems: {
        create: items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity || 1,
          unitPrice: priceMap.get(i.menuItemId) || 0,
          notes: i.notes || null,
        })),
      },
    },
    include: {
      table: true,
      orderItems: { include: { menuItem: true } },
    },
  })

  // If tableId provided, mark table as occupied/preparing
  if (tableId) {
    await db.table.update({
      where: { id: tableId },
      data: { status: 'OCCUPIED' },
    })
  }

  return NextResponse.json(order, { status: 201 })
}
