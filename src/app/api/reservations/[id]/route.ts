import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

const VALID_STATUS = ['PENDING', 'CONFIRMED', 'CANCELLED', 'SEATED', 'COMPLETED']

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const existing = await db.reservation.findFirst({
    where: { id, restaurantId: user.restaurantId },
  })
  if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const data: any = {}
  if (typeof body.customerName === 'string') data.customerName = body.customerName
  if (typeof body.phone === 'string') data.phone = body.phone
  if (body.email !== undefined) data.email = body.email || null
  if (typeof body.partySize === 'number') data.partySize = body.partySize
  if (body.date) data.date = new Date(body.date)
  if (typeof body.zone === 'string') data.zone = body.zone
  if (body.notes !== undefined) data.notes = body.notes || null
  if (body.tableId !== undefined) data.tableId = body.tableId || null
  if (typeof body.status === 'string' && VALID_STATUS.includes(body.status)) {
    data.status = body.status
    // Auto-confirm table status
    if (body.status === 'CONFIRMED' && body.tableId) {
      await db.table.update({
        where: { id: body.tableId },
        data: { status: 'RESERVED' },
      }).catch(() => null)
    }
  }

  const updated = await db.reservation.update({
    where: { id },
    data,
    include: { table: true },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const existing = await db.reservation.findFirst({
    where: { id, restaurantId: user.restaurantId },
  })
  if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  await db.reservation.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
