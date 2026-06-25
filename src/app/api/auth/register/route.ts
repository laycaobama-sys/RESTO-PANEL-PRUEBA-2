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

    const exists = await db.user.findUnique({ where: { email: emailLower } })
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
    while (await db.restaurant.findUnique({ where: { slug: slugUnique } })) {
      slugUnique = `${slug}-${attempt++}`
    }

    const passwordHash = await hashPassword(password)

    // Create the tenant (restaurant) AND its first admin user in a single
    // transaction so we never end up with an orphaned tenant or user.
    const [restaurant] = await db.$transaction([
      db.restaurant.create({
        data: {
          name: restaurantName,
          slug: slugUnique,
          phone,
          address,
          city,
          country,
          email: emailLower,
          settings: { create: {} },
        },
      }),
    ])

    const user = await db.user.create({
      data: {
        name,
        email: emailLower,
        passwordHash,
        role: 'ADMIN',
        restaurantId: restaurant.id,
        phone,
      },
    })

    // Create a verification token (would be emailed in production).
    // Even without email sending wired up, having the token in DB lets us
    // implement the verify-email flow later without schema changes.
    const verifyToken = randomBytes(32).toString('hex')
    await db.verificationToken.create({
      data: {
        token: verifyToken,
        type: 'VERIFY_EMAIL',
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    })

    return NextResponse.json({
      ok: true,
      userId: user.id,
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
      // Exposed for dev/demo purposes. In production this would be sent by
      // email instead of returned in the response body.
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
