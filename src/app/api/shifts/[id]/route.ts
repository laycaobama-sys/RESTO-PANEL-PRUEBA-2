import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const patch: any = {}
  if (body.staffName !== undefined) patch.staff_name = body.staffName
  if (body.team !== undefined) patch.team = body.team
  if (body.date !== undefined) patch.date = body.date
  if (body.startTime !== undefined) patch.start_time = body.startTime
  if (body.endTime !== undefined) patch.end_time = body.endTime
  if (body.role !== undefined) patch.role = body.role
  if (body.notes !== undefined) patch.notes = body.notes
  if (body.status !== undefined) patch.status = body.status

  const { data, error } = await supabaseAdmin
    .from('staff_shifts')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', user.organizationId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const { error } = await supabaseAdmin
    .from('staff_shifts')
    .delete()
    .eq('id', id)
    .eq('organization_id', user.organizationId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
