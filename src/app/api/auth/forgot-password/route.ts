import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { randomBytes } from 'crypto'
import { sendEmailAndLog, emailTemplates } from '@/lib/email'

const schema = z.object({ email: z.string().email() })

// In-memory rate limiter — max 3 reset requests per 10 min per IP.
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

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const resetUrl = `${baseUrl}/reset?token=${token}`

      // Send the email via Resend (or log in dev mode)
      await sendEmailAndLog({
        to: user.email,
        subject: 'Restablece tu contraseña · RestoPanel',
        template: emailTemplates.passwordReset({
          name: user.name,
          resetUrl,
          expiresIn: '1 hora',
        }),
      })

      // In dev mode, also return the token so the UI can auto-redirect
      // (no email actually sent unless RESEND_API_KEY is set)
      const isDev = process.env.NODE_ENV !== 'production'
      if (isDev) {
        return NextResponse.json({ ok: true, message: genericMessage, resetToken: token })
      }

      return NextResponse.json({ ok: true, message: genericMessage })
    }

    return NextResponse.json({ ok: true, message: genericMessage })
  } catch (e) {
    console.error('Forgot password error', e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
