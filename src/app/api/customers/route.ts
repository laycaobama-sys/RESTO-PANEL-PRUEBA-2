import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

// GET /api/customers — list with optional search
// POST /api/customers — create new customer
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const search = url.searchParams.get('q')
  const vipOnly = url.searchParams.get('vip') === 'true'
  const limit = Number(url.searchParams.get('limit') || '100')

  let q = supabaseAdmin
    .from('customers')
    .select('*')
    .eq('organization_id', user.organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (search) {
    q = q.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
  }
  if (vipOnly) q = q.eq('vip_status', true)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch tags for each customer
  const customerIds = (data || []).map((c: any) => c.id)
  let tagsMap = new Map<string, any[]>()
  if (customerIds.length > 0) {
    const { data: assignments } = await supabaseAdmin
      .from('customer_tag_assignments')
      .select('customer_id, customer_tags(id, name, color)')
      .in('customer_id', customerIds)
    for (const a of (assignments || []) as any[]) {
      const list = tagsMap.get(a.customer_id) || []
      if (a.customer_tags) list.push(a.customer_tags)
      tagsMap.set(a.customer_id, list)
    }
  }

  return NextResponse.json((data || []).map((c: any) => ({
    ...c,
    fullName: c.full_name,
    photoUrl: c.photo_url,
    vipStatus: c.vip_status,
    totalSpend: Number(c.total_spend),
    averageTicket: Number(c.average_ticket),
    visitsCount: c.visits_count,
    cancellationsCount: c.cancellations_count,
    noShowsCount: c.no_shows_count,
    lastVisitAt: c.last_visit_at,
    organizationId: c.organization_id,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    tags: tagsMap.get(c.id) || [],
  })))
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { fullName, phone, email, photoUrl, notes, preferences, allergies, rating, vipStatus, tags } = body

  if (!fullName || !phone) {
    return NextResponse.json({ error: 'Nombre y teléfono obligatorios' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('customers')
    .insert({
      full_name: fullName,
      phone,
      email: email || null,
      photo_url: photoUrl || null,
      notes: notes || null,
      preferences: preferences || null,
      allergies: allergies || null,
      rating: typeof rating === 'number' ? rating : 0,
      vip_status: vipStatus === true,
      organization_id: user.organizationId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Assign tags if provided
  if (tags && Array.isArray(tags) && tags.length > 0) {
    const tagRows = tags.map((t: any) => ({
      customer_id: data.id,
      tag_id: typeof t === 'string' ? t : t.id,
    }))
    await supabaseAdmin.from('customer_tag_assignments').insert(tagRows)
  }

  return NextResponse.json({ ...data, fullName: data.full_name, photoUrl: data.photo_url, vipStatus: data.vip_status }, { status: 201 })
}
