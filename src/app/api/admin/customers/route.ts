import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

// GET /api/admin/customers — list all customers across all tenants (super admin only)
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const search = url.searchParams.get('q')
  const limit = Number(url.searchParams.get('limit') || '100')

  let q = supabaseAdmin
    .from('customers')
    .select('id, full_name, phone, email, photo_url, vip_status, visits_count, no_shows_count, cancellations_count, total_spend, average_ticket, last_visit_at, created_at, organization_id, organizations(id, name, slug)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (search) {
    q = q.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data || []).map((c: any) => ({
    id: c.id,
    fullName: c.full_name,
    phone: c.phone,
    email: c.email,
    photoUrl: c.photo_url,
    vipStatus: c.vip_status,
    visitsCount: c.visits_count,
    noShowsCount: c.no_shows_count,
    cancellationsCount: c.cancellations_count,
    totalSpend: Number(c.total_spend),
    averageTicket: Number(c.average_ticket),
    lastVisitAt: c.last_visit_at,
    createdAt: c.created_at,
    organization: c.organizations,
    organizations: undefined,
  })))
}
