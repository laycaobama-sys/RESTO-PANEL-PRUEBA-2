import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

// GET /api/admin/health — system health check for the super admin panel
export async function GET() {
  const user = await getCurrentUser()
  if (!user || !user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const checks: any = {}

  // 1. Database connectivity + latency
  const dbStart = Date.now()
  const { error: dbErr } = await supabaseAdmin
    .from('organizations')
    .select('id', { count: 'exact', head: true })
  checks.database = {
    status: dbErr ? 'error' : 'ok',
    latencyMs: Date.now() - dbStart,
    error: dbErr?.message || null,
  }

  // 2. Recent errors from audit_logs (last 24h)
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data: recentErrors } = await supabaseAdmin
    .from('audit_logs')
    .select('id, action, actor_email, created_at')
    .gte('created_at', yesterday)
    .order('created_at', { ascending: false })
    .limit(5)
  checks.recentActivity = recentErrors || []

  // 3. Counts
  const [tenants, users, reservations, customers, orders] = await Promise.all([
    supabaseAdmin.from('organizations').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('reservations').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('customers').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }),
  ])
  checks.counts = {
    tenants: tenants.count || 0,
    users: users.count || 0,
    reservations: reservations.count || 0,
    customers: customers.count || 0,
    orders: orders.count || 0,
  }

  // 4. Top 5 tenants by reservations (last 30d)
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const { data: topTenants } = await supabaseAdmin
    .from('reservations')
    .select('organization_id, organizations(id, name, slug, status)')
    .gte('date', monthAgo)
  const tenantCountMap = new Map<string, { id: string; name: string; slug: string; status: string; count: number }>()
  for (const r of (topTenants || []) as any[]) {
    if (!r.organizations) continue
    const key = r.organization_id
    const existing = tenantCountMap.get(key) || {
      id: r.organizations.id,
      name: r.organizations.name,
      slug: r.organizations.slug,
      status: r.organizations.status,
      count: 0,
    }
    existing.count += 1
    tenantCountMap.set(key, existing)
  }
  checks.topTenants = Array.from(tenantCountMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // 5. Auth events (last 24h) — we don't have a dedicated auth_events table,
  // so we approximate with audit_logs actions that start with LOGIN/LOGOUT
  const { data: authEvents } = await supabaseAdmin
    .from('audit_logs')
    .select('id, action, actor_email, created_at')
    .gte('created_at', yesterday)
    .in('action', ['LOGIN', 'LOGOUT', 'IMPERSONATE_START', 'IMPERSONATE_END', 'TENANT_SUSPEND', 'TENANT_ACTIVATE'])
    .order('created_at', { ascending: false })
    .limit(10)
  checks.authEvents = authEvents || []

  // 6. Overall status
  checks.overall = checks.database.status === 'ok' ? 'healthy' : 'degraded'

  return NextResponse.json(checks)
}
