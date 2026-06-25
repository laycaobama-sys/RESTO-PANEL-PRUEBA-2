import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { slugify } from '@/lib/auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const existing = await db.category.findFirst({
    where: { id, restaurantId: user.restaurantId },
  })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const data: any = {}
  if (typeof body.name === 'string' && body.name.trim().length >= 2) {
    data.name = body.name.trim()
    if (data.name !== existing.name) {
      let slug = slugify(data.name)
      let slugUnique = slug
      let attempt = 1
      while (
        await db.category.findFirst({
          where: { restaurantId: user.restaurantId, slug: slugUnique, NOT: { id } },
        })
      ) {
        slugUnique = `${slug}-${attempt++}`
      }
      data.slug = slugUnique
    }
  }
  if (typeof body.icon === 'string' || body.icon === null) data.icon = body.icon
  if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder
  if (typeof body.visible === 'boolean') data.visible = body.visible

  const updated = await db.category.update({ where: { id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const existing = await db.category.findFirst({
    where: { id, restaurantId: user.restaurantId },
  })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  // Block delete if it has items (force user to move them or delete them first)
  const items = await db.menuItem.count({ where: { categoryId: id } })
  if (items > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: la categoría tiene ${items} plato(s). Elimínalos o muévelos primero.` },
      { status: 409 }
    )
  }

  await db.category.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
