import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

// Seeds demo customers + tags for the current tenant so the CRM
// has realistic data to show. Idempotent: skips customers that
// already exist by phone.
export async function POST() {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Create default tags
  const tagDefs = [
    { name: 'VIP', color: '#C5A059' },
    { name: 'Familiar', color: '#3b82f6' },
    { name: 'White wine', color: '#22c55e' },
    { name: 'Terraza', color: '#f59e0b' },
    { name: 'Cliente frecuente', color: '#a855f7' },
    { name: 'Alta prioridad', color: '#ef4444' },
    { name: 'Corporate', color: '#06b6d4' },
    { name: 'Ocasión especial', color: '#ec4899' },
  ]
  const { data: existingTags } = await supabaseAdmin
    .from('customer_tags')
    .select('id, name')
    .eq('organization_id', user.organizationId)
  const existingTagMap = new Map((existingTags || []).map((t: any) => [t.name, t.id]))

  const newTags = tagDefs.filter(t => !existingTagMap.has(t.name))
  if (newTags.length > 0) {
    const { data: created } = await supabaseAdmin
      .from('customer_tags')
      .insert(newTags.map(t => ({ ...t, organization_id: user.organizationId })))
      .select()
    for (const t of (created || []) as any[]) {
      existingTagMap.set(t.name, t.id)
    }
  }

  // Demo customers
  const customerDefs = [
    { full_name: 'Elena García', phone: '+34 611 222 333', email: 'elena@email.com', rating: 5, vip_status: true, notes: 'Cumpleaños el 15 de junio. Siempre pide mesa en terraza.', preferences: 'Mesa ventana, vino tinto Rioja', allergies: 'Frutos secos', tags: ['VIP', 'Terraza', 'White wine'], visits: 85, no_shows: 1, cancellations: 2, avg_ticket: 42 },
    { full_name: 'Javier Ruiz', phone: '+34 622 333 444', email: 'javier@email.com', rating: 4, vip_status: false, notes: 'Viene con su familia los domingos.', preferences: 'Zona interior, menú infantil', allergies: null, tags: ['Familiar', 'Cliente frecuente'], visits: 32, no_shows: 0, cancellations: 1, avg_ticket: 28 },
    { full_name: 'María López', phone: '+34 633 444 555', email: 'maria@email.com', rating: 5, vip_status: true, notes: 'Cliente corporate. Reserva para 8-10 personas mensualmente.', preferences: 'Zona VIP, cava', allergies: 'Marisco', tags: ['VIP', 'Corporate', 'Alta prioridad'], visits: 47, no_shows: 0, cancellations: 0, avg_ticket: 65 },
    { full_name: 'Carlos Martín', phone: '+34 644 555 666', email: 'carlos@email.com', rating: 3, vip_status: false, notes: 'Tuvo un no-show en marzo. Reconfirmar siempre.', preferences: null, allergies: null, tags: ['Cliente frecuente'], visits: 12, no_shows: 3, cancellations: 5, avg_ticket: 22 },
    { full_name: 'Ana Sánchez', phone: '+34 655 666 777', email: 'ana@email.com', rating: 5, vip_status: true, notes: 'Aniversario en octubre. Le gusta sorprender a su pareja.', preferences: 'Mesa tranquila, champán', allergies: 'Gluten', tags: ['VIP', 'Ocasión especial', 'White wine'], visits: 28, no_shows: 0, cancellations: 1, avg_ticket: 55 },
    { full_name: 'Pedro Gómez', phone: '+34 666 777 888', email: 'pedro@email.com', rating: 4, vip_status: false, notes: 'Cliente habitual de mediodía.', preferences: 'Barra, caña y tapa', allergies: null, tags: ['Cliente frecuente', 'Terraza'], visits: 56, no_shows: 2, cancellations: 3, avg_ticket: 18 },
  ]

  let created = 0
  for (const c of customerDefs) {
    // Check if exists by phone
    const { data: existing } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('organization_id', user.organizationId)
      .eq('phone', c.phone)
      .maybeSingle()
    if (existing) continue

    const { data: customer, error } = await supabaseAdmin
      .from('customers')
      .insert({
        full_name: c.full_name,
        phone: c.phone,
        email: c.email,
        rating: c.rating,
        vip_status: c.vip_status,
        notes: c.notes,
        preferences: c.preferences,
        allergies: c.allergies,
        visits_count: c.visits,
        no_shows_count: c.no_shows,
        cancellations_count: c.cancellations,
        average_ticket: c.avg_ticket,
        total_spend: c.visits * c.avg_ticket,
        last_visit_at: new Date(Date.now() - Math.random() * 30 * 24 * 3600 * 1000).toISOString(),
        organization_id: user.organizationId,
      })
      .select()
      .single()

    if (error || !customer) continue
    created++

    // Assign tags
    const tagIds = c.tags.map(name => existingTagMap.get(name)).filter(Boolean) as string[]
    if (tagIds.length > 0) {
      await supabaseAdmin
        .from('customer_tag_assignments')
        .insert(tagIds.map(tag_id => ({ customer_id: customer.id, tag_id })))
    }

    // Create a few historical reservations for this customer
    for (let i = 0; i < Math.min(c.visits, 5); i++) {
      const date = new Date(Date.now() - (i + 1) * 7 * 24 * 3600 * 1000)
      date.setHours(14 + Math.floor(Math.random() * 8), Math.random() > 0.5 ? 0 : 30, 0, 0)
      const status = i === 0 && c.no_shows > 0 ? 'NO_SHOW' : i === 1 && c.cancellations > 0 ? 'CANCELLED' : 'COMPLETED'
      await supabaseAdmin.from('reservations').insert({
        customer_name: c.full_name,
        phone: c.phone,
        email: c.email,
        party_size: 2 + Math.floor(Math.random() * 6),
        date: date.toISOString(),
        status,
        shift: date.getHours() < 17 ? 'LUNCH' : 'DINNER',
        zone: c.preferences?.includes('Terraza') ? 'TERRACE' : c.preferences?.includes('VIP') ? 'VIP' : 'INTERIOR',
        source: 'PHONE',
        customer_id: customer.id,
        duration_minutes: 120,
        organization_id: user.organizationId,
      })
    }
  }

  return NextResponse.json({ ok: true, created, tags: existingTagMap.size })
}
