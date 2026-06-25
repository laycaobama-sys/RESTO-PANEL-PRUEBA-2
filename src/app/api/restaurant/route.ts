import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const restaurant = await db.restaurant.findUnique({
    where: { id: user.restaurantId },
    include: { settings: true },
  })
  if (!restaurant) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(restaurant)
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const {
    name, phone, email, address, city, postalCode, description,
    logo, primaryColor, currency, openingHours, websiteUrl,
    publicEnabled, posEnabled, reservationsEnabled,
    settings,
  } = body

  const updated = await db.restaurant.update({
    where: { id: user.restaurantId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(city !== undefined ? { city } : {}),
      ...(postalCode !== undefined ? { postalCode } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(logo !== undefined ? { logo } : {}),
      ...(primaryColor !== undefined ? { primaryColor } : {}),
      ...(currency !== undefined ? { currency } : {}),
      ...(openingHours !== undefined ? { openingHours } : {}),
      ...(websiteUrl !== undefined ? { websiteUrl } : {}),
      ...(publicEnabled !== undefined ? { publicEnabled } : {}),
      ...(posEnabled !== undefined ? { posEnabled } : {}),
      ...(reservationsEnabled !== undefined ? { reservationsEnabled } : {}),
      ...(settings
        ? {
            settings: {
              upsert: {
                create: settings,
                update: settings,
              },
            },
          }
        : {}),
    },
    include: { settings: true },
  })
  return NextResponse.json(updated)
}
