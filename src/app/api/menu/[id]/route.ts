import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const existing = await db.menuItem.findFirst({
    where: { id, restaurantId: user.restaurantId },
  })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const data: any = {}
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
  if (body.description !== undefined) data.description = body.description || null
  if (typeof body.price === 'number' && body.price >= 0) data.price = body.price
  if (body.image !== undefined) data.image = body.image || null
  if (typeof body.available === 'boolean') data.available = body.available
  if (typeof body.visible === 'boolean') data.visible = body.visible
  if (body.allergens !== undefined) data.allergens = body.allergens || null
  if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder
  if (typeof body.categoryId === 'string' && body.categoryId) {
    const cat = await db.category.findFirst({
      where: { id: body.categoryId, restaurantId: user.restaurantId },
    })
    if (!cat) return NextResponse.json({ error: 'Categoría no válida' }, { status: 400 })
    data.categoryId = body.categoryId
  }

  const updated = await db.menuItem.update({
    where: { id },
    data,
    include: { category: true },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const existing = await db.menuItem.findFirst({
    where: { id, restaurantId: user.restaurantId },
  })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await db.menuItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
