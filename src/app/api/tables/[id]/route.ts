import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

const VALID_STATUS = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'PREPARING']
const VALID_ZONE = ['INTERIOR', 'TERRACE', 'BAR']

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const existing = await db.table.findFirst({
    where: { id, restaurantId: user.restaurantId },
  })
  if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const data: any = {}
  if (typeof body.number === 'string' && body.number.trim()) data.number = body.number.trim()
  if (body.name !== undefined) data.name = body.name || null
  if (typeof body.capacity === 'number') data.capacity = body.capacity
  if (typeof body.zone === 'string' && VALID_ZONE.includes(body.zone)) data.zone = body.zone
  if (typeof body.status === 'string' && VALID_STATUS.includes(body.status)) data.status = body.status

  const updated = await db.table.update({ where: { id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const existing = await db.table.findFirst({
    where: { id, restaurantId: user.restaurantId },
  })
  if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  await db.table.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
