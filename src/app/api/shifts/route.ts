import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const url = new URL(req.url)
  const date = url.searchParams.get('date')
  const team = url.searchParams.get('team')

  let q = supabaseAdmin
    .from('staff_shifts')
    .select('*')
    .eq('organization_id', user.organizationId)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (date) {
    const d = new Date(date)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)
    q = q.gte('date', weekStart.toISOString().slice(0, 10)).lt('date', weekEnd.toISOString().slice(0, 10))
  }
  if (team && team !== 'ALL') q = q.eq('team', team)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { staffName, staffAvatar, team, date, startTime, endTime, role, notes, status } = body
  if (!staffName || !date || !startTime || !endTime) {
    return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('staff_shifts')
    .insert({
      staff_name: staffName,
      staff_avatar: staffAvatar || null,
      team: team || 'SALA',
      date,
      start_time: startTime,
      end_time: endTime,
      role: role || null,
      notes: notes || null,
      status: status || 'CONFIRMED',
      organization_id: user.organizationId,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
