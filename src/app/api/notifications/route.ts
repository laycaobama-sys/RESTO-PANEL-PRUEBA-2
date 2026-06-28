import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

// Tenant-scoped notifications. Same table as super-admin notifications,
// but filtered by the user's organization_id. The user_id field can be
// null for "broadcast" notifications sent to everyone in the tenant.

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const unreadOnly = url.searchParams.get('unread') === 'true'
  const limit = Number(url.searchParams.get('limit') || '30')

  // Notifications where user_id is me OR user_id is null (broadcast to my tenant)
  // AND organization_id matches my tenant.
  let q = supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('organization_id', user.organizationId)
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (unreadOnly) q = q.is('read_at', null)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Count unread — for tenant users, "read" is tracked per-user via the
  // notifications_read table. For simplicity in this phase, we treat
  // user_id-matching notifications as personal and broadcast ones (user_id
  // is null) as "read" only if read_at is set (which would mark them read
  // for everyone — not ideal). For now, we use a per-user read table.
  const { data: readIds } = await supabaseAdmin
    .from('notifications_read')
    .select('notification_id')
    .eq('user_id', user.id)

  const readSet = new Set((readIds || []).map((r: any) => r.notification_id))
  const enriched = (data || []).map((n: any) => ({
    ...n,
    read_at: n.user_id === user.id ? n.read_at : (readSet.has(n.id) ? new Date().toISOString() : null),
  }))

  const unreadCount = enriched.filter(n => !n.read_at).length

  return NextResponse.json({
    notifications: enriched,
    unreadCount,
    total: enriched.length,
  })
}
