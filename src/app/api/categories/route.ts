import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { slugify } from '@/lib/format'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const categories = await db.category.listWithCounts(user.organizationId)
  // Translate snake_case → camelCase for frontend compatibility
  return NextResponse.json((categories || []).map((c: any) => ({
    ...c,
    sortOrder: c.sort_order,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    organizationId: c.organization_id,
    _count: c.menu_items ? { menuItems: c.menu_items[0]?.count || 0 } : undefined,
  })))
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { name, icon, sortOrder, visible } = body
  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  }
  let slug = slugify(name)
  let slugUnique = slug
  let attempt = 1
  while (await db.category.findFirst(user.organizationId, { slug: slugUnique })) {
    slugUnique = `${slug}-${attempt++}`
  }

  const category = await db.category.create({
    name: name.trim(),
    slug: slugUnique,
    icon: icon || null,
    sort_order: typeof sortOrder === 'number' ? sortOrder : 0,
    visible: visible !== false,
    organization_id: user.organizationId,
  })
  return NextResponse.json({
    ...category,
    sortOrder: category.sort_order,
    createdAt: category.created_at,
    updatedAt: category.updated_at,
    organizationId: category.organization_id,
  }, { status: 201 })
}
