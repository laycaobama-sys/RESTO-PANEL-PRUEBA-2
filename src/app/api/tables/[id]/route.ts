import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

const VALID_STATUS = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'PREPARING']
const VALID_ZONE = ['INTERIOR', 'TERRACE', 'BAR', 'VIP']
const VALID_SHAPE = ['SQUARE', 'ROUND', 'RECTANGLE']

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  // CRITICAL: findFirst filters by organizationId so we never touch
  // another tenant's table even if its id is leaked.
  const existing = await db.table.findFirst(user.organizationId, { id })
  if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const patch: any = {}
  if (typeof body.number === 'string' && body.number.trim()) patch.number = body.number.trim()
  if (body.name !== undefined) patch.name = body.name || null
  if (typeof body.capacity === 'number') patch.capacity = body.capacity
  if (typeof body.zone === 'string' && VALID_ZONE.includes(body.zone)) patch.zone = body.zone
  if (typeof body.shape === 'string' && VALID_SHAPE.includes(body.shape)) patch.shape = body.shape
  if (typeof body.status === 'string' && VALID_STATUS.includes(body.status)) patch.status = body.status
  if (typeof body.posX === 'number') patch.pos_x = body.posX
  if (typeof body.posY === 'number') patch.pos_y = body.posY

  const updated = await db.table.update(id, user.organizationId, patch)
  return NextResponse.json({
    ...updated,
    posX: updated.pos_x,
    posY: updated.pos_y,
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const existing = await db.table.findFirst(user.organizationId, { id })
  if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  await db.table.delete(id, user.organizationId)
  return NextResponse.json({ ok: true })
}
