import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

// GET /api/admin/notifications — list notifications for the current super admin
// POST /api/admin/notifications — create a notification (also used by other routes internally)
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const unreadOnly = url.searchParams.get('unread') === 'true'
  const limit = Number(url.searchParams.get('limit') || '50')

  let q = supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (unreadOnly) q = q.is('read_at', null)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Unread count for the bell badge
  const { count: unreadCount } = await supabaseAdmin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)

  return NextResponse.json({
    notifications: data || [],
    unreadCount: unreadCount || 0,
    total: count || 0,
  })
}

// Internal helper to create notifications from other API routes.
// Not exposed to the browser directly.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json()
  const { type, severity, title, message, organizationId, actionUrl, metadata } = body

  // Use the SQL helper so all super admins get notified, not just the caller.
  const { error } = await supabaseAdmin.rpc('notify_super_admins', {
    p_type: type,
    p_severity: severity || 'info',
    p_title: title,
    p_message: message,
    p_organization_id: organizationId || null,
    p_action_url: actionUrl || null,
    p_metadata: metadata || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
