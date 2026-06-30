import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

// GET /api/tables/available?date=2026-07-01&time=14:00&pax=4
// Returns tables that are free for the requested slot.
// A table is "available" if there's no overlapping reservation
// (±duration_minutes window) in the same date.
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const date = url.searchParams.get('date')
  const time = url.searchParams.get('time') // "14:00"
  const pax = Number(url.searchParams.get('pax') || '2')
  const duration = Number(url.searchParams.get('duration') || '120') // minutes

  if (!date || !time) {
    return NextResponse.json({ error: 'date y time obligatorios' }, { status: 400 })
  }

  // Build the requested slot window
  const slotStart = new Date(`${date}T${time}:00`)
  const slotEnd = new Date(slotStart.getTime() + duration * 60000)

  // Fetch all tables that can accommodate the party
  const { data: tables, error: tablesErr } = await supabaseAdmin
    .from('tables')
    .select('*')
    .eq('organization_id', user.organizationId)
    .gte('capacity', pax)
    .order('zone', { ascending: true })
    .order('number', { ascending: true })

  if (tablesErr) return NextResponse.json({ error: tablesErr.message }, { status: 500 })

  // Fetch all reservations for that date (to check overlaps)
  const dayStart = new Date(`${date}T00:00:00`)
  const dayEnd = new Date(`${date}T23:59:59`)
  const { data: dayReservations } = await supabaseAdmin
    .from('reservations')
    .select('id, table_id, date, duration_minutes, status')
    .eq('organization_id', user.organizationId)
    .gte('date', dayStart.toISOString())
    .lte('date', dayEnd.toISOString())
    .in('status', ['CONFIRMED', 'PENDING', 'SEATED'])

  // For each table, check if any reservation overlaps the requested slot
  const availableTables = (tables || []).filter((t: any) => {
    const tableReservations = (dayReservations || []).filter((r: any) => r.table_id === t.id)
    for (const r of tableReservations) {
      const rStart = new Date(r.date)
      const rDuration = r.duration_minutes || 120
      const rEnd = new Date(rStart.getTime() + rDuration * 60000)
      // Overlap check: slotStart < rEnd && slotEnd > rStart
      if (slotStart < rEnd && slotEnd > rStart) {
        return false // table is booked
      }
    }
    return true
  })

  return NextResponse.json(availableTables.map((t: any) => ({
    ...t,
    posX: t.pos_x,
    posY: t.pos_y,
    organizationId: t.organization_id,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  })))
}
