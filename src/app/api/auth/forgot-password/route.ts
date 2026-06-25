import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { randomBytes } from 'crypto'

const schema = z.object({
  email: z.string().email(),
})

// POST /api/auth/forgot-password { email }
// Generates a reset token (1h expiry). In production the link would be
// emailed to the user. For dev/demo we return the token directly so the
// flow can be tested end-to-end without an SMTP server.
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Email no válido' }, { status: 400 })
    }
    const email = parsed.data.email.toLowerCase().trim()
    const user = await db.user.findUnique({ where: { email } })

    // For security, always return the same response whether or not the email
    // exists. We only create a token if the user is found.
    if (user) {
      const token = randomBytes(32).toString('hex')
      await db.verificationToken.create({
        data: {
          token,
          type: 'RESET_PASSWORD',
          userId: user.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      })
      // Dev/demo only: return the token so the UI can show it.
      return NextResponse.json({
        ok: true,
        message: 'Si el email existe, recibirás un enlace de recuperación.',
        // Remove `resetToken` from the response when you wire up real email.
        resetToken: token,
      })
    }

    return NextResponse.json({
      ok: true,
      message: 'Si el email existe, recibirás un enlace de recuperación.',
    })
  } catch (e) {
    console.error('Forgot password error', e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
