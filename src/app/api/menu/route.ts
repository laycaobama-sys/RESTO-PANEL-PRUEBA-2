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

  const items = await db.menuItem.findMany({
    where: {
      restaurantId: user.restaurantId,
      ...(categoryId ? { categoryId } : {}),
      ...(search
        ? { name: { contains: search } }
        : {}),
      ...(includeHidden ? {} : { visible: true }),
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { category: true },
  })
  return NextResponse.json(items)
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

  // Validate category belongs to restaurant
  const cat = await db.category.findFirst({
    where: { id: categoryId, restaurantId: user.restaurantId },
  })
  if (!cat) return NextResponse.json({ error: 'Categoría no válida' }, { status: 400 })

  const item = await db.menuItem.create({
    data: {
      name: name.trim(),
      description: description || null,
      price,
      image: image || null,
      available: available !== false,
      visible: visible !== false,
      allergens: allergens || null,
      sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
      categoryId,
      restaurantId: user.restaurantId,
    },
    include: { category: true },
  })
  return NextResponse.json(item, { status: 201 })
}
