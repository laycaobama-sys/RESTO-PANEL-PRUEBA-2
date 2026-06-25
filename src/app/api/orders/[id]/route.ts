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

  const existing = await db.order.findFirst({
    where: { id, restaurantId: user.restaurantId },
  })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  let newStatus = existing.status
  if (action === 'cancel') newStatus = 'CANCELLED'
  else if (status && ['PENDING', 'PREPARING', 'SERVED', 'COMPLETED', 'CANCELLED'].includes(status)) {
    newStatus = status
  } else if (action === 'advance') {
    newStatus = NEXT_STATUS[existing.status] || existing.status
  }

  const updated = await db.order.update({
    where: { id },
    data: { status: newStatus },
    include: { table: true, orderItems: { include: { menuItem: true } } },
  })

  // Update table status if needed
  if (existing.tableId) {
    const tableStatus =
      newStatus === 'COMPLETED' || newStatus === 'CANCELLED'
        ? 'AVAILABLE'
        : newStatus === 'PREPARING'
        ? 'PREPARING'
        : 'OCCUPIED'
    await db.table.update({
      where: { id: existing.tableId },
      data: { status: tableStatus },
    })
  }

  return NextResponse.json(updated)
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const order = await db.order.findFirst({
    where: { id, restaurantId: user.restaurantId },
    include: { table: true, orderItems: { include: { menuItem: true } } },
  })
  if (!order) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(order)
}
