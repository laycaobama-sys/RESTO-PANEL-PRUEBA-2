import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { randomBytes } from 'crypto'

const schema = z.object({ email: z.string().email() })

// In-memory rate limiter — max 3 reset requests per 10 min per IP.
// Prevents enumeration via timing and brute-force token guessing.
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 3
const attempts = new Map<string, { count: number; firstAt: number }>()

function getIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for')
  if (xf) return xf.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAt: now })
    return false
  }
  entry.count += 1
  return entry.count > MAX_PER_WINDOW
}

export async function POST(req: Request) {
  // Rate limit
  const ip = getIp(req)
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: 'too_many_requests', message: 'Demasiados intentos. Inténtalo más tarde.' },
      { status: 429 }
    )
  }

  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Email no válido' }, { status: 400 })
    const email = parsed.data.email.toLowerCase().trim()
    const user = await db.user.findByEmail(email)

    // Always return the same response whether the email exists or not,
    // to prevent user-enumeration attacks.
    const genericMessage = 'Si el email existe, recibirás un enlace de recuperación.'

    if (user) {
      const token = randomBytes(32).toString('hex')
      await db.verificationToken.create({
        token,
        type: 'RESET_PASSWORD',
        user_id: user.id,
        organization_id: user.organization_id ?? '',
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
      })

      // In development, return the token so the user can reset without email.
      // In production, NEVER expose the token — wire up a real email provider.
      const isDev = process.env.NODE_ENV !== 'production'
      if (isDev) {
        return NextResponse.json({ ok: true, message: genericMessage, resetToken: token })
      }

      // Production: here you would send the email with the reset link.
      // Example: await sendEmail(user.email, 'reset-password', `${process.env.NEXTAUTH_URL}/reset?token=${token}`)
      // For now we just acknowledge the request without exposing the token.
      return NextResponse.json({ ok: true, message: genericMessage })
    }

    return NextResponse.json({ ok: true, message: genericMessage })
  } catch (e) {
    console.error('Forgot password error', e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
