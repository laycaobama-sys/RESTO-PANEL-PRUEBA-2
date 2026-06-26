import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

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
    const record = await db.verificationToken.findByToken(token)
    if (!record || record.type !== 'RESET_PASSWORD' || record.used_at) {
      return NextResponse.json({ error: 'Token inválido o ya utilizado' }, { status: 400 })
    }
    if (new Date(record.expires_at) < new Date()) {
      return NextResponse.json({ error: 'El enlace ha caducado. Solicita uno nuevo.' }, { status: 400 })
    }

    const passwordHash = await hashPassword(password)
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    await supabaseAdmin.from('users').update({ password_hash: passwordHash }).eq('id', record.user_id)
    await db.verificationToken.markUsed(record.id)

    return NextResponse.json({ ok: true, message: 'Contraseña actualizada correctamente' })
  } catch (e) {
    console.error('Reset password error', e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
