import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

// GET /api/customers/[id] — full profile with tags + reservation history
// PATCH /api/customers/[id] — update customer
// DELETE /api/customers/[id] — delete customer
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const { id } = await params

  const { data: customer, error } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('organization_id', user.organizationId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!customer) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  // Fetch tags
  const { data: assignments } = await supabaseAdmin
    .from('customer_tag_assignments')
    .select('customer_tags(id, name, color)')
    .eq('customer_id', id)
  const tags = (assignments || []).map((a: any) => a.customer_tags).filter(Boolean)

  // Fetch reservation history
  const { data: reservations } = await supabaseAdmin
    .from('reservations')
    .select('id, date, party_size, status, shift, zone, table_id, notes, duration_minutes, channel, tables(number, name, zone)')
    .eq('customer_id', id)
    .order('date', { ascending: false })
    .limit(50)

  // Compute behavior metrics from the customer row
  const behavior = {
    totalSpend: Number(customer.total_spend),
    averageTicket: Number(customer.average_ticket),
    visitsCount: customer.visits_count,
    cancellationsCount: customer.cancellations_count,
    noShowsCount: customer.no_shows_count,
    lastVisitAt: customer.last_visit_at,
    rating: customer.rating,
    // Derived: frequency (visits per month approx)
    frequencyPerMonth: customer.visits_count > 0 && customer.created_at
      ? Math.round((customer.visits_count / Math.max(1, (Date.now() - new Date(customer.created_at).getTime()) / (30 * 24 * 3600 * 1000))) * 10) / 10
      : 0,
    // Derived: estimated customer value (total spend + potential)
    estimatedValue: Number(customer.total_spend) + (customer.visits_count * Number(customer.average_ticket) * 0.3),
  }

  return NextResponse.json({
    ...customer,
    fullName: customer.full_name,
    photoUrl: customer.photo_url,
    vipStatus: customer.vip_status,
    totalSpend: Number(customer.total_spend),
    averageTicket: Number(customer.average_ticket),
    visitsCount: customer.visits_count,
    cancellationsCount: customer.cancellations_count,
    noShowsCount: customer.no_shows_count,
    lastVisitAt: customer.last_visit_at,
    organizationId: customer.organization_id,
    createdAt: customer.created_at,
    updatedAt: customer.updated_at,
    tags,
    behavior,
    reservations: (reservations || []).map((r: any) => ({
      ...r,
      partySize: r.party_size,
      tableId: r.table_id,
      durationMinutes: r.duration_minutes,
      table: r.tables,
      tables: undefined,
    })),
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json()

  // Verify tenancy
  const { data: existing } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('id', id)
    .eq('organization_id', user.organizationId)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const patch: any = {}
  if (body.fullName !== undefined) patch.full_name = body.fullName
  if (body.phone !== undefined) patch.phone = body.phone
  if (body.email !== undefined) patch.email = body.email || null
  if (body.photoUrl !== undefined) patch.photo_url = body.photoUrl || null
  if (body.notes !== undefined) patch.notes = body.notes || null
  if (body.preferences !== undefined) patch.preferences = body.preferences || null
  if (body.allergies !== undefined) patch.allergies = body.allergies || null
  if (typeof body.rating === 'number') patch.rating = body.rating
  if (typeof body.vipStatus === 'boolean') patch.vip_status = body.vipStatus

  const { data, error } = await supabaseAdmin
    .from('customers')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update tags if provided
  if (Array.isArray(body.tags)) {
    await supabaseAdmin.from('customer_tag_assignments').delete().eq('customer_id', id)
    if (body.tags.length > 0) {
      const tagRows = body.tags.map((t: any) => ({
        customer_id: id,
        tag_id: typeof t === 'string' ? t : t.id,
      }))
      await supabaseAdmin.from('customer_tag_assignments').insert(tagRows)
    }
  }

  return NextResponse.json({ ...data, fullName: data.full_name, photoUrl: data.photo_url, vipStatus: data.vip_status })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const { id } = await params
  const { data: existing } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('id', id)
    .eq('organization_id', user.organizationId)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const { error } = await supabaseAdmin
    .from('customers')
    .delete()
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
