import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Public endpoint - no auth required
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    include: { settings: true },
  })
  if (!restaurant || !restaurant.publicEnabled) {
    return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
  }

  const categories = await db.category.findMany({
    where: { restaurantId: restaurant.id, visible: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      menuItems: {
        where: { visible: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      },
    },
  })

  return NextResponse.json({
    restaurant: {
      name: restaurant.name,
      slug: restaurant.slug,
      description: restaurant.description,
      logo: restaurant.logo,
      phone: restaurant.phone,
      email: restaurant.email,
      address: restaurant.address,
      city: restaurant.city,
      primaryColor: restaurant.primaryColor,
      currency: restaurant.currency,
      openingHours: restaurant.openingHours,
      websiteUrl: restaurant.websiteUrl,
      settings: restaurant.settings,
    },
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      menuItems: c.menuItems.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        price: m.price,
        image: m.image,
        available: m.available,
        allergens: m.allergens,
      })),
    })),
  })
}
