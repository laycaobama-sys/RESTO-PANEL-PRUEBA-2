import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { slugify } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const categories = await db.category.findMany({
    where: { restaurantId: user.restaurantId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { menuItems: true } } },
  })
  return NextResponse.json(categories)
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
  while (
    await db.category.findFirst({
      where: { restaurantId: user.restaurantId, slug: slugUnique },
    })
  ) {
    slugUnique = `${slug}-${attempt++}`
  }

  const category = await db.category.create({
    data: {
      name: name.trim(),
      slug: slugUnique,
      icon: icon || null,
      sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
      visible: visible !== false,
      restaurantId: user.restaurantId,
    },
  })
  return NextResponse.json(category, { status: 201 })
}
