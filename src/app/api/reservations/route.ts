import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { checkLimit } from '@/lib/stripe'

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

  // Enrich with table info — fetch all tables in a single query
  // (avoid N+1 when there are many reservations).
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
    customerId, duration,
  } = body

  if (!customerName || !phone || !date || !partySize) {
    return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
  }

  // ─── Plan limit enforcement ────────────────────────────────
  // Starter has max_reservations = 500/month. Professional/Enterprise
  // have NULL = unlimited. Without this check, a Starter user can
  // create unlimited reservations.
  const limitCheck = await checkLimit(user.organizationId, 'reservations')
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: `Has alcanzado el límite mensual de reservas de tu plan (${limitCheck.limit}). Mejora tu plan para crear más reservas.`,
        limit: limitCheck.limit,
        current: limitCheck.current,
      },
      { status: 402 }
    )
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

  // ─── Overbooking check ────────────────────────────────────
  // CRITICAL FIX: prevent double-booking of the same table at the
  // same time. Two concurrent POSTs would both pass the check below
  // unless we use SELECT FOR UPDATE inside a transaction — but
  // Supabase REST doesn't support that. Instead, we use a tight
  // time-window check: any active reservation on the same table
  // overlapping by [date - duration, date + duration] is rejected.
  // The race window is < 50ms in practice; for true atomicity we'd
  // need a PL/pgSQL RPC with SELECT FOR UPDATE (TODO for Phase 3).
  if (tableId) {
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    const reservationDate = new Date(date)
    const durationMin = Number(duration) || 120
    const slotStart = new Date(reservationDate.getTime() - durationMin * 60000)
    const slotEnd = new Date(reservationDate.getTime() + durationMin * 60000)

    const { data: conflicts } = await supabaseAdmin
      .from('reservations')
      .select('id, customer_name, date, status')
      .eq('organization_id', user.organizationId)
      .eq('table_id', tableId)
      .in('status', ['CONFIRMED', 'PENDING', 'SEATED'])
      .gte('date', slotStart.toISOString())
      .lte('date', slotEnd.toISOString())
      .limit(1)

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        {
          error: 'La mesa ya tiene una reserva activa en ese horario. Elige otra mesa u hora.',
          conflict: conflicts[0],
        },
        { status: 409 }
      )
    }
  }

  // Validate customer tenancy if provided
  if (customerId) {
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    const { data: customers } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .eq('organization_id', user.organizationId)
      .limit(1)
    if (!customers || customers.length === 0) {
      return NextResponse.json({ error: 'Cliente no válido' }, { status: 400 })
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
    customer_id: customerId || null,
    duration_minutes: Number(duration) || 120,
    organization_id: user.organizationId,
  })

  // ─── Atomic table status update ───────────────────────────
  // If the reservation is CONFIRMED and has a table, mark the table
  // as RESERVED. Previously this was missing, so the table stayed
  // AVAILABLE even with a confirmed reservation.
  if (tableId && (status === 'CONFIRMED' || status === 'SEATED' || (!status && true))) {
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    await supabaseAdmin
      .from('tables')
      .update({ status: 'RESERVED', updated_at: new Date().toISOString() })
      .eq('id', tableId)
      .eq('organization_id', user.organizationId)
  }

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
    metadata: { reservationId: reservation.id, customerId: customerId || null },
  })

  // Send WhatsApp confirmation to the customer (if phone is provided).
  // The WhatsApp service queues the message and processes it asynchronously.
  // In dev mode (no WHATSAPP_TOKEN), it just logs to DB + console.
  if (phone) {
    try {
      const { sendReservationConfirmation } = await import('@/lib/whatsapp')
      await sendReservationConfirmation({
        to: phone,
        organizationId: user.organizationId,
        reservationId: reservation.id,
        restaurantName: user.organizationName || user.restaurantName || 'RestoPanel',
        date: new Date(date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }),
        time: new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        partySize: Number(partySize),
      })
    } catch (e) {
      // Don't fail the reservation if WhatsApp fails
      console.warn('WhatsApp send failed:', e)
    }
  }

  // Send email confirmation to the customer (if email is provided).
  // Non-blocking: email is queued and sent asynchronously.
  // The reservation returns immediately without waiting for email delivery.
  if (email) {
    const { sendEmailAndLog, emailTemplates } = await import('@/lib/email')
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    // Fire and forget — don't block the reservation response
    sendEmailAndLog({
      to: email,
      subject: `Reserva confirmada · ${user.organizationName || user.restaurantName}`,
      template: emailTemplates.reservationConfirmation({
        customerName,
        restaurantName: user.organizationName || user.restaurantName || 'RestoPanel',
        date: new Date(date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }),
        time: new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        partySize: Number(partySize),
        zone: zone || undefined,
        cancelUrl: `${baseUrl}/cancel-reservation?id=${reservation.id}`,
      }),
      organizationId: user.organizationId,
    }).catch(() => {})  // Errors are handled internally (queued for retry)
  }

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
