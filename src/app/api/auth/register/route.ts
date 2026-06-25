import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword, slugify } from '@/lib/auth'

const registerSchema = z.object({
  name: z.string().min(2, 'El nombre es demasiado corto'),
  email: z.string().email('Email no válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  restaurantName: z.string().min(2, 'El nombre del restaurante es obligatorio'),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
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
    const { name, email, password, restaurantName, phone, address, city } = parsed.data
    const emailLower = email.toLowerCase()

    const exists = await db.user.findUnique({ where: { email: emailLower } })
    if (exists) {
      return NextResponse.json(
        { error: 'Ya existe una cuenta con este email' },
        { status: 409 }
      )
    }

    let slug = slugify(restaurantName)
    let slugUnique = slug
    let attempt = 1
    while (await db.restaurant.findUnique({ where: { slug: slugUnique } })) {
      slugUnique = `${slug}-${attempt++}`
    }

    const passwordHash = await hashPassword(password)
    const restaurant = await db.restaurant.create({
      data: {
        name: restaurantName,
        slug: slugUnique,
        phone,
        address,
        city,
        settings: { create: {} },
      },
    })

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

    return NextResponse.json({
      ok: true,
      userId: user.id,
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
    })
  } catch (e) {
    console.error('Register error', e)
    return NextResponse.json(
      { error: 'Error al crear la cuenta' },
      { status: 500 }
    )
  }
}
