import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/auth/verify-email?token=xxx
// Marks the user's email as verified. In production the link with this token
// would be sent by email upon registration.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) {
      return NextResponse.json(
        { error: 'Token no proporcionado' },
        { status: 400 }
      )
    }

    const record = await db.verificationToken.findUnique({
      where: { token },
    })
    if (!record || record.type !== 'VERIFY_EMAIL' || record.usedAt) {
      return NextResponse.json(
        { error: 'Token inválido o ya utilizado' },
        { status: 400 }
      )
    }
    if (record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'El enlace ha caducado. Solicita uno nuevo.' },
        { status: 400 }
      )
    }

    await db.$transaction([
      db.user.update({
        where: { id: record.userId },
        data: { emailVerified: true },
      }),
      db.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ])

    return NextResponse.json({ ok: true, message: 'Email verificado correctamente' })
  } catch (e) {
    console.error('Verify email error', e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
