import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

// Global search for super admin. Searches across:
//   - organizations (by name, slug, email, city, country)
//   - users (by email, name, phone)
//   - reservations (by customer_name, phone, email)
// Returns grouped results with a preview so the frontend can render
// a structured dropdown.

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim().toLowerCase()
  if (q.length < 2) {
    return NextResponse.json({ tenants: [], users: [], reservations: [] })
  }

  // LIKE patterns for Supabase (case-insensitive via ilike)
  const like = `%${q}%`

  const [tenants, users, reservations] = await Promise.all([
    supabaseAdmin
      .from('organizations')
      .select('id, name, slug, email, phone, city, country, status, created_at')
      .or(`name.ilike.${like},slug.ilike.${like},email.ilike.${like},city.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(10),
    supabaseAdmin
      .from('users')
      .select('id, email, name, phone, role, is_super_admin, organization_id, created_at, organizations(id, name, slug)')
      .or(`email.ilike.${like},name.ilike.${like},phone.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(10),
    supabaseAdmin
      .from('reservations')
      .select('id, customer_name, phone, email, party_size, date, status, shift, zone, organization_id, organizations(id, name, slug)')
      .or(`customer_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
      .order('date', { ascending: false })
      .limit(10),
  ])

  return NextResponse.json({
    tenants: tenants.data || [],
    users: (users.data || []).map((u: any) => ({
      ...u,
      organization: u.organizations,
      organizations: undefined,
    })),
    reservations: (reservations.data || []).map((r: any) => ({
      ...r,
      organization: r.organizations,
      organizations: undefined,
    })),
  })
}
