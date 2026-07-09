import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { hashPassword } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * Creates the SUPER_ADMIN (owner) account if it doesn't exist yet.
 *
 * Credentials MUST be supplied via environment variables:
 *   SUPER_ADMIN_EMAIL     (default: owner@restopanel.es)
 *   SUPER_ADMIN_PASSWORD  (REQUIRED — no hardcoded default)
 *
 * This endpoint is restricted to SUPER_ADMIN by middleware, so it can
 * only be called by an existing super-admin or by an operator with
 * direct server access. In production, prefer running this as a CLI
 * script (`npm run db:seed-super-admin`) instead of via HTTP.
 */
export async function POST() {
  try {
    const email = process.env.SUPER_ADMIN_EMAIL || 'owner@restopanel.es'
    const password = process.env.SUPER_ADMIN_PASSWORD

    if (!password || password.length < 12) {
      return NextResponse.json(
        {
          error:
            'SUPER_ADMIN_PASSWORD no configurada o demasiado corta (mínimo 12 caracteres). Defínela en .env y vuelve a intentarlo.',
        },
        { status: 500 }
      )
    }

    // Check if it already exists
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id, email, is_super_admin')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      // Ensure it has super admin flag
      if (!existing.is_super_admin) {
        await supabaseAdmin
          .from('users')
          .update({ is_super_admin: true, role: 'SUPER_ADMIN' })
          .eq('id', existing.id)
      }
      return NextResponse.json({
        ok: true,
        message: 'SUPER_ADMIN ya existe (flag actualizado)',
        email,
      })
    }

    const passwordHash = await hashPassword(password)
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        name: 'Owner',
        role: 'SUPER_ADMIN',
        is_super_admin: true,
        organization_id: null,
        email_verified: true,
      })
      .select('id, email, role, is_super_admin')
      .single()

    if (error) throw error

    logger.info('SUPER_ADMIN created', 'auth', { email })
    return NextResponse.json({
      ok: true,
      message: 'SUPER_ADMIN creado correctamente',
      user: data,
      email,
    })
  } catch (e) {
    logger.error('Seed super admin error', 'auth', { error: (e as Error).message })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
