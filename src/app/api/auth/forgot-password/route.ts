import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { randomBytes } from 'crypto'

const schema = z.object({ email: z.string().email() })

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Email no válido' }, { status: 400 })
    const email = parsed.data.email.toLowerCase().trim()
    const user = await db.user.findByEmail(email)

    if (user) {
      const token = randomBytes(32).toString('hex')
      await db.verificationToken.create({
        token,
        type: 'RESET_PASSWORD',
        user_id: user.id,
        organization_id: user.organization_id,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
      })
      return NextResponse.json({
        ok: true,
        message: 'Si el email existe, recibirás un enlace de recuperación.',
        resetToken: token, // dev/demo only
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
