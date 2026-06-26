import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Public endpoint - no auth required. Used by the restaurant's public web.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const restaurant = await db.organization.findBySlug(slug)
  if (!restaurant || !restaurant.public_enabled) {
    return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
  }

  const settings = await db.organizationSettings.findByOrg(restaurant.id)

  // Fetch visible categories
  const { data: categories } = await supabaseAdmin
    .from('categories')
    .select('*')
    .eq('organization_id', restaurant.id)
    .eq('visible', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  // Fetch visible menu items
  const { data: menuItems } = await supabaseAdmin
    .from('menu_items')
    .select('*')
    .eq('organization_id', restaurant.id)
    .eq('visible', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  const itemsByCategory = new Map<string, any[]>()
  for (const m of menuItems || []) {
    const list = itemsByCategory.get(m.category_id) || []
    list.push(m)
    itemsByCategory.set(m.category_id, list)
  }

  return NextResponse.json({
    restaurant: {
      name: restaurant.name,
      slug: restaurant.slug,
      description: restaurant.description,
      logo: restaurant.logo,
      phone: restaurant.phone,
      email: restaurant.email,
      address: restaurant.address,
      city: restaurant.city,
      primaryColor: restaurant.primary_color,
      currency: restaurant.currency,
      openingHours: restaurant.opening_hours,
      websiteUrl: restaurant.website_url,
      settings: settings ? {
        monOpen: settings.mon_open, monClose: settings.mon_close,
        tueOpen: settings.tue_open, tueClose: settings.tue_close,
        wedOpen: settings.wed_open, wedClose: settings.wed_close,
        thuOpen: settings.thu_open, thuClose: settings.thu_close,
        friOpen: settings.fri_open, friClose: settings.fri_close,
        satOpen: settings.sat_open, satClose: settings.sat_close,
        sunOpen: settings.sun_open, sunClose: settings.sun_close,
        taxRate: settings.tax_rate,
        serviceCharge: settings.service_charge,
      } : null,
    },
    categories: (categories || []).map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      menuItems: (itemsByCategory.get(c.id) || []).map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        price: Number(m.price),
        image: m.image,
        available: m.available,
        allergens: m.allergens,
      })),
    })),
  })
}
