import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { slugify } from '@/lib/format'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const existing = await db.category.findFirst(user.organizationId, { id })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const patch: any = {}
  if (typeof body.name === 'string' && body.name.trim().length >= 2) {
    patch.name = body.name.trim()
    if (patch.name !== existing.name) {
      let slug = slugify(patch.name)
      let slugUnique = slug
      let attempt = 1
      while (await db.category.findFirst(user.organizationId, { slug: slugUnique, id: { ne: id } })) {
        slugUnique = `${slug}-${attempt++}`
      }
      patch.slug = slugUnique
    }
  }
  if (typeof body.icon === 'string' || body.icon === null) patch.icon = body.icon
  if (typeof body.sortOrder === 'number') patch.sort_order = body.sortOrder
  if (typeof body.visible === 'boolean') patch.visible = body.visible

  const updated = await db.category.update(id, user.organizationId, patch)
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const existing = await db.category.findFirst(user.organizationId, { id })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  // Block delete if it has items
  const { supabaseAdmin } = await import('@/lib/supabase/admin')
  const { count } = await supabaseAdmin
    .from('menu_items')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)
    .eq('organization_id', user.organizationId)
  if (count && count > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: la categoría tiene ${count} plato(s). Elimínalos o muévelos primero.` },
      { status: 409 }
    )
  }

  await db.category.delete(id, user.organizationId)
  return NextResponse.json({ ok: true })
}
