import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

// POST /api/auth/reset-password { token, password }
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 }
      )
    }
    const { token, password } = parsed.data

    const record = await db.verificationToken.findUnique({ where: { token } })
    if (!record || record.type !== 'RESET_PASSWORD' || record.usedAt) {
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

    const passwordHash = await hashPassword(password)
    await db.$transaction([
      db.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      db.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ])

    return NextResponse.json({ ok: true, message: 'Contraseña actualizada correctamente' })
  } catch (e) {
    console.error('Reset password error', e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
