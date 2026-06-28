import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

// PATCH /api/notifications/[id] — mark a notification as read (for the current user)
// Works for both personal (user_id = me) and broadcast (user_id = null) notifications.
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const { id } = await params

  // Verify the notification belongs to the user's tenant
  const { data: notif, error: notifErr } = await supabaseAdmin
    .from('notifications')
    .select('id, user_id, organization_id')
    .eq('id', id)
    .maybeSingle()
  if (notifErr) return NextResponse.json({ error: notifErr.message }, { status: 500 })
  if (!notif) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (notif.organization_id !== user.organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // If it's a personal notification (user_id = me), update read_at directly.
  if (notif.user_id === user.id) {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    // Broadcast — insert into notifications_read (idempotent via unique constraint)
    const { error } = await supabaseAdmin
      .from('notifications_read')
      .upsert({ notification_id: id, user_id: user.id, read_at: new Date().toISOString() })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
