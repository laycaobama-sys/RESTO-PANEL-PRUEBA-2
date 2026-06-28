import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

export async function POST() {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Get all unread notifications for this user (personal + broadcast)
  const { data: notifs, error } = await supabaseAdmin
    .from('notifications')
    .select('id, user_id')
    .eq('organization_id', user.organizationId)
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .is('read_at', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const personalIds = (notifs || []).filter((n: any) => n.user_id === user.id).map((n: any) => n.id)
  const broadcastIds = (notifs || []).filter((n: any) => n.user_id === null).map((n: any) => n.id)

  // Mark personal ones as read directly
  if (personalIds.length > 0) {
    await supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', personalIds)
  }
  // Insert into notifications_read for broadcast ones
  if (broadcastIds.length > 0) {
    const rows = broadcastIds.map((nid: string) => ({
      notification_id: nid,
      user_id: user.id,
      read_at: new Date().toISOString(),
    }))
    await supabaseAdmin.from('notifications_read').upsert(rows)
  }

  return NextResponse.json({ ok: true, marked: personalIds.length + broadcastIds.length })
}
