import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { revokeAllUserSessions } from '@/lib/session-management'
import { logger } from '@/lib/logger'

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

    // CRITICAL FIX: revoke ALL existing sessions for this user so
    // that any stolen JWT (from before the password change) is
    // immediately invalid. Without this, a compromised account
    // remains accessible to the attacker for up to 30 days.
    // We revoke ALL sessions (including the current one) because
    // the user just proved they have a new password — they must
    // re-authenticate with it.
    await revokeAllUserSessions(record.user_id)
    logger.info('Password reset — all sessions revoked', 'auth', { userId: record.user_id })

    return NextResponse.json({ ok: true, message: 'Contraseña actualizada correctamente. Por favor, inicia sesión de nuevo.' })
  } catch (e) {
    logger.error('Reset password error', 'auth', { error: (e as Error).message })
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
