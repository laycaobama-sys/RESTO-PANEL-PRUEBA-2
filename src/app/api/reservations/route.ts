import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const date = url.searchParams.get('date')

  const where: any = { restaurantId: user.restaurantId }
  if (status && status !== 'ALL') where.status = status
  if (date) {
    const d = new Date(date)
    const next = new Date(d)
    next.setDate(d.getDate() + 1)
    where.date = { gte: d, lt: next }
  }

  const reservations = await db.reservation.findMany({
    where,
    orderBy: { date: 'asc' },
    include: { table: true },
  })
  return NextResponse.json(reservations)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { customerName, phone, email, partySize, date, zone, notes, tableId, status } = body

  if (!customerName || !phone || !date || !partySize) {
    return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
  }

  const reservation = await db.reservation.create({
    data: {
      customerName,
      phone,
      email: email || null,
      partySize: Number(partySize),
      date: new Date(date),
      status: status || 'PENDING',
      zone: zone || null,
      notes: notes || null,
      tableId: tableId || null,
      restaurantId: user.restaurantId,
    },
    include: { table: true },
  })
  return NextResponse.json(reservation, { status: 201 })
}
