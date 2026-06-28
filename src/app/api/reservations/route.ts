import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const shift = url.searchParams.get('shift')
  const zone = url.searchParams.get('zone')
  const date = url.searchParams.get('date')

  const reservations = await db.reservation.list(user.organizationId, {
    status: status || undefined,
    shift: shift || undefined,
    zone: zone || undefined,
    date: date || undefined,
  })

  // Enrich with table info
  const tableIds = Array.from(new Set(reservations.map((r) => r.table_id).filter(Boolean) as string[]))
  const tables = tableIds.length > 0
    ? await Promise.all(tableIds.map((id) => db.table.findFirst(user.organizationId, { id })))
    : []
  const tableMap = new Map(tables.filter(Boolean).map((t) => [t!.id, t]))

  return NextResponse.json(
    reservations.map((r) => ({
      ...r,
      customerName: r.customer_name,
      partySize: r.party_size,
      endTime: r.end_time,
      tableId: r.table_id,
      organizationId: r.organization_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      table: r.table_id ? tableMap.get(r.table_id) : null,
    }))
  )
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const {
    customerName, phone, email, partySize, date, zone, notes, tableId, status, shift, source,
  } = body

  if (!customerName || !phone || !date || !partySize) {
    return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
  }

  // Validate table tenancy if provided
  if (tableId) {
    const table = await db.table.findFirst(user.organizationId, { id: tableId })
    if (!table) {
      return NextResponse.json(
        { error: 'La mesa seleccionada no pertenece a tu restaurante' },
        { status: 403 }
      )
    }
  }

  const reservation = await db.reservation.create({
    customer_name: customerName,
    phone,
    email: email || null,
    party_size: Number(partySize),
    date: new Date(date).toISOString(),
    status: status || 'PENDING',
    shift: shift || 'DINNER',
    zone: zone || null,
    source: source || 'PHONE',
    notes: notes || null,
    table_id: tableId || null,
    organization_id: user.organizationId,
  })

  // Auto-generate a notification for the tenant's staff.
  const { supabaseAdmin } = await import('@/lib/supabase/admin')
  await supabaseAdmin.from('notifications').insert({
    user_id: null, // broadcast to all tenant users
    organization_id: user.organizationId,
    type: 'NEW_RESERVATION',
    severity: 'info',
    title: `Nueva reserva: ${customerName}`,
    message: `${partySize} pax · ${new Date(date).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${shift === 'LUNCH' ? 'Comida' : 'Cena'}${zone ? ` · ${zone}` : ''}`,
    action_url: null,
    metadata: { reservationId: reservation.id },
  })

  const table = tableId ? await db.table.findFirst(user.organizationId, { id: tableId }) : null
  return NextResponse.json({
    ...reservation,
    customerName: reservation.customer_name,
    partySize: reservation.party_size,
    endTime: reservation.end_time,
    tableId: reservation.table_id,
    organizationId: reservation.organization_id,
    createdAt: reservation.created_at,
    updatedAt: reservation.updated_at,
    table,
  }, { status: 201 })
}
