import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'
import { randomUUID } from 'crypto'

// POST /api/tables/group — group multiple tables together
// DELETE /api/tables/group — ungroup (remove group_id from tables)
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { tableIds } = body as { tableIds: string[] }

  if (!tableIds || tableIds.length < 2) {
    return NextResponse.json({ error: 'Se necesitan al menos 2 mesas para agrupar' }, { status: 400 })
  }

  // Verify all tables belong to the tenant
  const { data: tables } = await supabaseAdmin
    .from('tables')
    .select('id, number, capacity, zone')
    .in('id', tableIds)
    .eq('organization_id', user.organizationId)

  if (!tables || tables.length !== tableIds.length) {
    return NextResponse.json({ error: 'Algunas mesas no pertenecen a tu restaurante' }, { status: 403 })
  }

  // Generate a group_id and assign it to all tables
  const groupId = randomUUID()
  const { error } = await supabaseAdmin
    .from('tables')
    .update({ group_id: groupId })
    .in('id', tableIds)
    .eq('organization_id', user.organizationId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Calculate total capacity of the group
  const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0)

  return NextResponse.json({
    ok: true,
    groupId,
    tableIds,
    totalCapacity,
    message: `${tables.length} mesas agrupadas (capacidad total: ${totalCapacity} personas)`,
  })
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const groupId = url.searchParams.get('groupId')

  if (!groupId) {
    return NextResponse.json({ error: 'groupId required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('tables')
    .update({ group_id: null })
    .eq('group_id', groupId)
    .eq('organization_id', user.organizationId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, message: 'Mesas desagrupadas' })
}
