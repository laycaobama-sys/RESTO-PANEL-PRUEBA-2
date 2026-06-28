import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || !user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const org = await db.organization.findById(id)
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch full detail: settings, users, recent orders/reservations
  const [settings, users, categories, menuItems, tables, reservations, orders] = await Promise.all([
    db.organizationSettings.findByOrg(id),
    (async () => {
      const { supabaseAdmin } = await import('@/lib/supabase/admin')
      const { data } = await supabaseAdmin.from('users').select('*').eq('organization_id', id).order('created_at', { ascending: true })
      return data || []
    })(),
    db.category.list(id),
    db.menuItem.list(id, { includeHidden: true }),
    db.table.list(id),
    db.reservation.list(id, {}),
    db.order.list(id, { limit: 20 }),
  ])

  return NextResponse.json({
    organization: { ...org, status: org.status },
    settings,
    users,
    categories,
    menuItems,
    tables,
    reservations,
    orders,
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || !user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json()
  const { status } = body as { status?: 'ACTIVE' | 'SUSPENDED' | 'PENDING' }
  if (status && ['ACTIVE', 'SUSPENDED', 'PENDING'].includes(status)) {
    const org = await db.organization.findById(id)
    if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const updated = await db.superAdmin.updateTenantStatus(id, status)
    await logAction({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: 'SUPER_ADMIN',
      action: status === 'SUSPENDED' ? 'TENANT_SUSPEND' : status === 'ACTIVE' ? 'TENANT_ACTIVATE' : 'TENANT_SET_PENDING',
      targetType: 'organization',
      targetId: id,
      targetName: org.name,
      organizationId: id,
      details: { previousStatus: org.status, newStatus: status },
      req,
    })
    return NextResponse.json(updated)
  }
  return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
}
