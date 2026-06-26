import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'Token no proporcionado' }, { status: 400 })

    const record = await db.verificationToken.findByToken(token)
    if (!record || record.type !== 'VERIFY_EMAIL' || record.used_at) {
      return NextResponse.json({ error: 'Token inválido o ya utilizado' }, { status: 400 })
    }
    if (new Date(record.expires_at) < new Date()) {
      return NextResponse.json({ error: 'El enlace ha caducado. Solicita uno nuevo.' }, { status: 400 })
    }

    // Mark user as verified + token as used.
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    await supabaseAdmin.from('users').update({ email_verified: true }).eq('id', record.user_id)
    await db.verificationToken.markUsed(record.id)

    return NextResponse.json({ ok: true, message: 'Email verificado correctamente' })
  } catch (e) {
    console.error('Verify email error', e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
