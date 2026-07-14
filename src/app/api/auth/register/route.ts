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

    // Create the tenant (organization) using supabaseAdmin directly
    // to avoid schema mismatch issues with db.organization.create
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: restaurantName,
        slug: slugUnique,
        phone: phone || null,
        address: address || null,
        city: city || null,
        country,
        email: emailLower,
        primary_color: '#FF6B35',
        currency: 'EUR',
        public_enabled: true,
        pos_enabled: true,
        reservations_enabled: true,
      })
      .select()
      .single()

    if (orgError || !orgData) {
      console.error('Register: org create error', orgError)
      return NextResponse.json(
        { error: 'Error al crear el restaurante: ' + (orgError?.message || 'unknown') },
        { status: 500 }
      )
    }

    const organization = orgData

    // Seed default settings row (best-effort, don't fail if table doesn't exist)
    try {
      await supabaseAdmin.from('organization_settings').upsert({
        organization_id: organization.id,
      })
    } catch (e) {
      console.warn('Settings seed failed:', e)
    }

    // Create the admin user
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        email: emailLower,
        password_hash: passwordHash,
        name,
        phone: phone || null,
        role: 'ADMIN',
        is_super_admin: false,
        organization_id: organization.id,
        email_verified: true, // Auto-verify in dev mode
      })
      .select()
      .single()

    if (userError || !userData) {
      console.error('Register: user create error', userError)
      return NextResponse.json(
        { error: 'Error al crear el usuario: ' + (userError?.message || 'unknown') },
        { status: 500 }
      )
    }

    const user = userData

    // Create a verification token and send verification email
    const verifyToken = randomBytes(32).toString('hex')
    await db.verificationToken.create({
      token: verifyToken,
      type: 'VERIFY_EMAIL',
      user_id: user.id,
      organization_id: organization.id,
      expires_at: new Date(Date.now() + 24 * 3600 * 1000),
    })

    // Send welcome + verification emails (via Resend if configured,
    // otherwise logged to console in dev mode)
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    try {
      const { sendEmailAndLog, emailTemplates } = await import('@/lib/email')
      await sendEmailAndLog({
        to: user.email,
        subject: `¡Bienvenido a RestoPanel, ${name}! 🎉`,
        template: emailTemplates.welcome({
          name,
          restaurantName,
          loginUrl: `${baseUrl}/login`,
        }),
        organizationId: organization.id,
      })
      await sendEmailAndLog({
        to: user.email,
        subject: 'Verifica tu email · RestoPanel',
        template: emailTemplates.emailVerification({
          name,
          verifyUrl: `${baseUrl}/verify-email?token=${verifyToken}`,
        }),
        organizationId: organization.id,
      })
    } catch (emailErr) {
      // Don't fail registration if email fails
      console.warn('Welcome email failed:', emailErr)
    }

    return NextResponse.json({
      ok: true,
      userId: user.id,
      restaurantId: organization.id,
      organizationId: organization.id,
      restaurantSlug: organization.slug,
      // CRITICAL FIX: do NOT return verifyToken in the response.
      // Previously, anyone could register with a throwaway email and
      // immediately self-verify without ever opening the email. The
      // verification token is sent ONLY via email now.
      message: 'Cuenta creada. Revisa tu email para verificar tu cuenta.',
    })
  } catch (e) {
    console.error('Register error', e)
    return NextResponse.json(
      { error: 'Error al crear la cuenta' },
      { status: 500 }
    )
  }
}
