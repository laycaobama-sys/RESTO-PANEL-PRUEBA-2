import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const url = new URL(req.url)
  const categoryId = url.searchParams.get('categoryId')
  const search = url.searchParams.get('q')
  const includeHidden = url.searchParams.get('all') === 'true'

  const items = await db.menuItem.list(user.organizationId, {
    categoryId: categoryId || undefined,
    search: search || undefined,
    includeHidden,
  })
  // Translate snake_case → camelCase for frontend compatibility
  return NextResponse.json(items.map((i) => ({
    ...i,
    categoryId: i.category_id,
    sortOrder: i.sort_order,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
    organizationId: i.organization_id,
  })))
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { name, description, price, image, categoryId, available, visible, allergens, sortOrder } = body

  if (!name || !name.trim()) return NextResponse.json({ error: 'Nombre obligatorio' }, { status: 400 })
  if (typeof price !== 'number' || price < 0) return NextResponse.json({ error: 'Precio inválido' }, { status: 400 })
  if (!categoryId) return NextResponse.json({ error: 'Categoría obligatoria' }, { status: 400 })

  // Validate category belongs to tenant
  const cat = await db.category.findFirst(user.organizationId, { id: categoryId })
  if (!cat) return NextResponse.json({ error: 'Categoría no válida' }, { status: 400 })

  const item = await db.menuItem.create({
    name: name.trim(),
    description: description || null,
    price,
    image: image || null,
    available: available !== false,
    visible: visible !== false,
    allergens: allergens || null,
    sort_order: typeof sortOrder === 'number' ? sortOrder : 0,
    category_id: categoryId,
    organization_id: user.organizationId,
  })
  return NextResponse.json({
    ...item,
    categoryId: item.category_id,
    sortOrder: item.sort_order,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    organizationId: item.organization_id,
  }, { status: 201 })
}
