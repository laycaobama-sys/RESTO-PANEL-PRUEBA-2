import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

// GET /api/customers/search?q=... — quick search for the new-reservation flow
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim().toLowerCase()
  if (q.length < 2) return NextResponse.json([])

  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('id, full_name, phone, email, photo_url, vip_status, visits_count, last_visit_at')
    .eq('organization_id', user.organizationId)
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
    .order('visits_count', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data || []).map((c: any) => ({
    ...c,
    fullName: c.full_name,
    photoUrl: c.photo_url,
    vipStatus: c.vip_status,
    visitsCount: c.visits_count,
    lastVisitAt: c.last_visit_at,
  })))
}
