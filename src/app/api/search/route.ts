import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

// Tenant-scoped search. The admin/staff user can search within their own
// restaurant's data only — organization_id is always derived from the
// session and forced on every query.

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim().toLowerCase()
  if (q.length < 2) {
    return NextResponse.json({ reservations: [], menuItems: [], tables: [], users: [] })
  }

  const like = `%${q}%`
  const orgId = user.organizationId

  const [reservations, menuItems, tables, users] = await Promise.all([
    supabaseAdmin
      .from('reservations')
      .select('id, customer_name, phone, email, party_size, date, status, shift, zone, table_id')
      .eq('organization_id', orgId)
      .or(`customer_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
      .order('date', { ascending: false })
      .limit(10),
    supabaseAdmin
      .from('menu_items')
      .select('id, name, description, price, available, visible, category_id, categories(name)')
      .eq('organization_id', orgId)
      .or(`name.ilike.${like},description.ilike.${like},allergens.ilike.${like}`)
      .order('name', { ascending: true })
      .limit(10),
    supabaseAdmin
      .from('tables')
      .select('id, number, name, capacity, zone, shape, status, pos_x, pos_y')
      .eq('organization_id', orgId)
      .or(`number.ilike.${like},name.ilike.${like},zone.ilike.${like}`)
      .order('zone', { ascending: true })
      .limit(10),
    // "Customers" are derived from reservations — we don't have a separate
    // customers table, so we search unique customer_name/phone/email combos.
    supabaseAdmin
      .from('reservations')
      .select('customer_name, phone, email')
      .eq('organization_id', orgId)
      .or(`customer_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
      .order('date', { ascending: false })
      .limit(50),
  ])

  // Deduplicate customers by phone (or email if no phone)
  const customerMap = new Map<string, { name: string; phone: string; email: string | null; reservations: number }>()
  for (const r of (users.data || []) as any[]) {
    const key = r.phone || r.email || r.customer_name
    const existing = customerMap.get(key)
    if (existing) {
      existing.reservations += 1
    } else {
      customerMap.set(key, {
        name: r.customer_name,
        phone: r.phone,
        email: r.email,
        reservations: 1,
      })
    }
  }
  const customers = Array.from(customerMap.values())
    .sort((a, b) => b.reservations - a.reservations)
    .slice(0, 10)

  return NextResponse.json({
    reservations: (reservations.data || []).map((r: any) => ({
      ...r,
      partySize: r.party_size,
      tableId: r.table_id,
    })),
    menuItems: (menuItems.data || []).map((m: any) => ({
      ...m,
      categoryId: m.category_id,
      categoryName: m.categories?.name || null,
      categories: undefined,
    })),
    tables: (tables.data || []).map((t: any) => ({
      ...t,
      posX: t.pos_x,
      posY: t.pos_y,
    })),
    customers,
  })
}
