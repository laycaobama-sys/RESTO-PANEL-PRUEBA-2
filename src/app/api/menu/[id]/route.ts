import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const existing = await db.menuItem.findById(id, user.organizationId)
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const patch: any = {}
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
  if (body.description !== undefined) patch.description = body.description || null
  if (typeof body.price === 'number' && body.price >= 0) patch.price = body.price
  if (body.image !== undefined) patch.image = body.image || null
  if (typeof body.available === 'boolean') patch.available = body.available
  if (typeof body.visible === 'boolean') patch.visible = body.visible
  if (body.allergens !== undefined) patch.allergens = body.allergens || null
  if (typeof body.sortOrder === 'number') patch.sort_order = body.sortOrder
  if (typeof body.categoryId === 'string' && body.categoryId) {
    const cat = await db.category.findFirst(user.organizationId, { id: body.categoryId })
    if (!cat) return NextResponse.json({ error: 'Categoría no válida' }, { status: 400 })
    patch.category_id = body.categoryId
  }

  const updated = await db.menuItem.update(id, user.organizationId, patch)
  return NextResponse.json({
    ...updated,
    categoryId: updated.category_id,
    sortOrder: updated.sort_order,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
    organizationId: updated.organization_id,
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const existing = await db.menuItem.findById(id, user.organizationId)
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await db.menuItem.delete(id, user.organizationId)
  return NextResponse.json({ ok: true })
}
