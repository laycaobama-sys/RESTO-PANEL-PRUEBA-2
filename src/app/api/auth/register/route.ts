import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword, slugify } from '@/lib/auth'
import { randomBytes } from 'crypto'

const registerSchema = z.object({
  name: z.string().min(2, 'Tu nombre es demasiado corto'),
  email: z.string().email('Email no válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  restaurantName: z.string().min(2, 'El nombre del restaurante es obligatorio'),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    // Pre-launch gate: when LAUNCH_MODE=private, public registration is disabled.
    // Only the super admin can create new tenants from the admin panel.
    if (process.env.LAUNCH_MODE === 'private') {
      return NextResponse.json(
        {
          error:
            'El registro público está desactivado en modo pre-lanzamiento. Contacta con el equipo de RestoPanel.',
        },
        { status: 403 }
      )
    }

    const body = await req.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 }
      )
    }
    const {
      name,
      email,
      password,
      restaurantName,
      phone,
      address,
      city,
      country = 'España',
    } = parsed.data
    const emailLower = email.toLowerCase().trim()

    const exists = await db.user.findByEmail(emailLower)
    if (exists) {
      return NextResponse.json(
        { error: 'Ya existe una cuenta con este email' },
        { status: 409 }
      )
    }

    // Generate a unique slug for the public restaurant URL
    let slug = slugify(restaurantName)
    let slugUnique = slug
    let attempt = 1
    while (await db.organization.findBySlug(slugUnique)) {
      slugUnique = `${slug}-${attempt++}`
    }

    const passwordHash = await hashPassword(password)

    // Create the tenant (organization) and its first admin user.
    // OrganizationSettings row is created in a separate call so we can
    // fail the whole operation cleanly if anything goes wrong.
    const organization = await db.organization.create({
      name: restaurantName,
      slug: slugUnique,
      phone: phone || null,
      address: address || null,
      city: city || null,
      country,
      email: emailLower,
      logo: null,
      description: null,
      primary_color: '#FF6B35',
      currency: 'EUR',
      opening_hours: null,
      website_url: null,
      public_enabled: true,
      pos_enabled: true,
      reservations_enabled: true,
    })

    // Seed default settings row.
    await db.organizationSettings.upsert(organization.id, {})

    const user = await db.user.create({
      email: emailLower,
      password_hash: passwordHash,
      name,
      phone: phone || null,
      role: 'ADMIN',
      organization_id: organization.id,
    })

    // Create a verification token (would be emailed in production).
    const verifyToken = randomBytes(32).toString('hex')
    await db.verificationToken.create({
      token: verifyToken,
      type: 'VERIFY_EMAIL',
      user_id: user.id,
      organization_id: organization.id,
      expires_at: new Date(Date.now() + 24 * 3600 * 1000),
    })

    return NextResponse.json({
      ok: true,
      userId: user.id,
      restaurantId: organization.id,
      organizationId: organization.id,
      restaurantSlug: organization.slug,
      verifyToken,
    })
  } catch (e) {
    console.error('Register error', e)
    return NextResponse.json(
      { error: 'Error al crear la cuenta' },
      { status: 500 }
    )
  }
}
