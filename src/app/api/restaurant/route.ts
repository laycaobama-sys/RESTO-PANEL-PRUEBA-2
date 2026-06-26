import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const org = await db.organization.findById(user.organizationId)
  if (!org) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const settings = await db.organizationSettings.findByOrg(user.organizationId)

  // Translate snake_case → camelCase for frontend compatibility
  return NextResponse.json({
    ...org,
    postalCode: org.postal_code,
    primaryColor: org.primary_color,
    openingHours: org.opening_hours,
    websiteUrl: org.website_url,
    publicEnabled: org.public_enabled,
    posEnabled: org.pos_enabled,
    reservationsEnabled: org.reservations_enabled,
    emailVerified: org.email_verified,
    createdAt: org.created_at,
    updatedAt: org.updated_at,
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
  })
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const {
    name, phone, email, address, city, postalCode, description,
    logo, primaryColor, currency, openingHours, websiteUrl,
    publicEnabled, posEnabled, reservationsEnabled,
    settings,
  } = body

  const orgPatch: any = {}
  if (name !== undefined) orgPatch.name = name
  if (phone !== undefined) orgPatch.phone = phone
  if (email !== undefined) orgPatch.email = email
  if (address !== undefined) orgPatch.address = address
  if (city !== undefined) orgPatch.city = city
  if (postalCode !== undefined) orgPatch.postal_code = postalCode
  if (description !== undefined) orgPatch.description = description
  if (logo !== undefined) orgPatch.logo = logo
  if (primaryColor !== undefined) orgPatch.primary_color = primaryColor
  if (currency !== undefined) orgPatch.currency = currency
  if (openingHours !== undefined) orgPatch.opening_hours = openingHours
  if (websiteUrl !== undefined) orgPatch.website_url = websiteUrl
  if (publicEnabled !== undefined) orgPatch.public_enabled = publicEnabled
  if (posEnabled !== undefined) orgPatch.pos_enabled = posEnabled
  if (reservationsEnabled !== undefined) orgPatch.reservations_enabled = reservationsEnabled

  const updated = await db.organization.update(user.organizationId, orgPatch)

  if (settings) {
    const settingsPatch: any = {}
    for (const [k, v] of Object.entries(settings)) {
      // Convert camelCase keys (monOpen) to snake_case (mon_open)
      const snake = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
      settingsPatch[snake] = v
    }
    await db.organizationSettings.upsert(user.organizationId, settingsPatch)
  }

  const refreshedOrg = await db.organization.findById(user.organizationId)
  const refreshedSettings = await db.organizationSettings.findByOrg(user.organizationId)
  return NextResponse.json({
    ...refreshedOrg,
    postalCode: refreshedOrg?.postal_code,
    primaryColor: refreshedOrg?.primary_color,
    openingHours: refreshedOrg?.opening_hours,
    websiteUrl: refreshedOrg?.website_url,
    publicEnabled: refreshedOrg?.public_enabled,
    posEnabled: refreshedOrg?.pos_enabled,
    reservationsEnabled: refreshedOrg?.reservations_enabled,
    emailVerified: refreshedOrg?.email_verified,
    settings: refreshedSettings,
  })
}
