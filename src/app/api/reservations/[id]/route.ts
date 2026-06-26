import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

const VALID_STATUS = ['PENDING', 'CONFIRMED', 'CANCELLED', 'SEATED', 'COMPLETED', 'NO_SHOW']

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const existing = await db.reservation.findById(id, user.organizationId)
  if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const patch: any = {}
  if (typeof body.customerName === 'string') patch.customer_name = body.customerName
  if (typeof body.phone === 'string') patch.phone = body.phone
  if (body.email !== undefined) patch.email = body.email || null
  if (typeof body.partySize === 'number') patch.party_size = body.partySize
  if (body.date) patch.date = new Date(body.date).toISOString()
  if (typeof body.shift === 'string') patch.shift = body.shift
  if (typeof body.zone === 'string') patch.zone = body.zone
  if (typeof body.source === 'string') patch.source = body.source
  if (body.notes !== undefined) patch.notes = body.notes || null
  if (body.tableId !== undefined) patch.table_id = body.tableId || null
  if (typeof body.status === 'string' && VALID_STATUS.includes(body.status)) {
    patch.status = body.status
    if (body.status === 'CONFIRMED' && body.tableId) {
      await db.table.update(body.tableId, user.organizationId, { status: 'RESERVED' }).catch(() => null)
    }
  }

  const updated = await db.reservation.update(id, user.organizationId, patch)
  const table = updated.table_id ? await db.table.findFirst(user.organizationId, { id: updated.table_id }) : null
  return NextResponse.json({
    ...updated,
    customerName: updated.customer_name,
    partySize: updated.party_size,
    endTime: updated.end_time,
    tableId: updated.table_id,
    organizationId: updated.organization_id,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
    table,
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const existing = await db.reservation.findById(id, user.organizationId)
  if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  await db.reservation.delete(id, user.organizationId)
  return NextResponse.json({ ok: true })
}
