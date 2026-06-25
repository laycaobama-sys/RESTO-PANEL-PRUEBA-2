import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const tables = await db.table.findMany({
    where: { restaurantId: user.restaurantId },
    orderBy: [{ zone: 'asc' }, { number: 'asc' }],
    include: {
      orders: {
        where: { status: { in: ['PENDING', 'PREPARING', 'SERVED'] } },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  return NextResponse.json(tables)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { number, name, capacity, zone } = body
  if (!number || !number.trim()) return NextResponse.json({ error: 'Número obligatorio' }, { status: 400 })

  const existing = await db.table.findFirst({
    where: { restaurantId: user.restaurantId, number: number.trim() },
  })
  if (existing) return NextResponse.json({ error: 'Ya existe una mesa con ese número' }, { status: 409 })

  const table = await db.table.create({
    data: {
      number: number.trim(),
      name: name || null,
      capacity: typeof capacity === 'number' ? capacity : 4,
      zone: zone || 'INTERIOR',
      status: 'AVAILABLE',
      restaurantId: user.restaurantId,
    },
  })
  return NextResponse.json(table, { status: 201 })
}
