import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { hashPassword } from '@/lib/auth'

/**
 * Creates the SUPER_ADMIN (owner) account if it doesn't exist yet.
 *
 * This account has is_super_admin=true and NO organization_id (it operates
 * globally). Use it to:
 *   - Access /admin (the global panel)
 *   - List all tenants, users, audit logs
 *   - Impersonate any tenant for support
 *
 * Default credentials:
 *   Email:    owner@restopanel.es
 *   Password: owner2026
 *
 * CHANGE THE PASSWORD IMMEDIATELY after first login in production.
 */
export async function POST() {
  try {
    const email = 'owner@restopanel.es'
    const password = 'owner2026'

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
        credentials: { email, password: '***' },
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

    return NextResponse.json({
      ok: true,
      message: 'SUPER_ADMIN creado correctamente',
      user: data,
      credentials: { email, password },
    })
  } catch (e) {
    console.error('Seed super admin error', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
