import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const tenants = await db.superAdmin.listTenants()
  return NextResponse.json(tenants)
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json()
  const { id, status } = body as { id: string; status: 'ACTIVE' | 'SUSPENDED' | 'PENDING' }
  if (!id || !['ACTIVE', 'SUSPENDED', 'PENDING'].includes(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
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

  // Notify all super admins about the status change
  const { supabaseAdmin } = await import('@/lib/supabase/admin')
  await supabaseAdmin.rpc('notify_super_admins', {
    p_type: status === 'SUSPENDED' ? 'TENANT_SUSPENDED' : status === 'ACTIVE' ? 'TENANT_ACTIVATED' : 'TENANT_SET_PENDING',
    p_severity: status === 'SUSPENDED' ? 'warning' : 'success',
    p_title: status === 'SUSPENDED' ? `Empresa suspendida: ${org.name}` : status === 'ACTIVE' ? `Empresa activada: ${org.name}` : `Empresa pendiente: ${org.name}`,
    p_message: `${user.email} cambió el estado de "${org.name}" de ${org.status} a ${status}`,
    p_organization_id: id,
    p_action_url: '/admin',
    p_metadata: { previousStatus: org.status, newStatus: status, actor: user.email },
  })

  return NextResponse.json(updated)
}
