import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

// Generates a set of demo notifications for the current super admin.
// Useful to verify the bell works before real events trigger notifications.
export async function POST() {
  const user = await getCurrentUser()
  if (!user || !user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch real tenants to reference in notifications
  const { data: orgs } = await supabaseAdmin
    .from('organizations')
    .select('id, name, status')
    .order('created_at', { ascending: false })
    .limit(5)

  const orgList = orgs || []
  const now = new Date()
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60000).toISOString()

  const notifications = [
    {
      type: 'NEW_TENANT',
      severity: 'success',
      title: 'Nueva empresa registrada',
      message: orgList[0] ? `"${orgList[0].name}" se ha registrado en la plataforma` : 'Una nueva empresa se ha registrado',
      organization_id: orgList[0]?.id || null,
      action_url: '/admin',
      created_at: minutesAgo(2),
    },
    {
      type: 'IMPERSONATION',
      severity: 'info',
      title: 'Sesión de impersonación',
      message: 'Una sesión de soporte ha entrado en un tenant',
      organization_id: orgList[1]?.id || null,
      action_url: '/admin',
      created_at: minutesAgo(15),
    },
    {
      type: 'HIGH_CANCEL_RATE',
      severity: 'warning',
      title: 'Tasa de cancelación elevada',
      message: orgList[1] ? `"${orgList[1].name}" tiene 35% de cancelaciones en los últimos 7 días` : 'Un tenant supera el 30% de cancelaciones',
      organization_id: orgList[1]?.id || null,
      action_url: '/admin',
      created_at: minutesAgo(45),
    },
    {
      type: 'TENANT_SUSPENDED',
      severity: 'warning',
      title: 'Empresa suspendida',
      message: 'Una empresa ha sido suspendida manualmente',
      organization_id: orgList[2]?.id || null,
      action_url: '/admin',
      created_at: minutesAgo(120),
    },
    {
      type: 'SYSTEM',
      severity: 'error',
      title: 'Error de base de datos',
      message: 'Timeout en consulta a la tabla reservations (resuelto)',
      organization_id: null,
      action_url: '/admin',
      created_at: minutesAgo(180),
    },
    {
      type: 'NEW_TENANT',
      severity: 'success',
      title: 'Nueva empresa registrada',
      message: orgList[2] ? `"${orgList[2].name}" se ha registrado` : 'Nueva empresa registrada',
      organization_id: orgList[2]?.id || null,
      action_url: '/admin',
      created_at: minutesAgo(1440),
    },
  ]

  // Insert each notification for the current super admin only
  for (const n of notifications) {
    await supabaseAdmin.from('notifications').insert({
      user_id: user.id,
      type: n.type,
      severity: n.severity,
      title: n.title,
      message: n.message,
      organization_id: n.organization_id,
      action_url: n.action_url,
      created_at: n.created_at,
    })
  }

  return NextResponse.json({ ok: true, count: notifications.length })
}
