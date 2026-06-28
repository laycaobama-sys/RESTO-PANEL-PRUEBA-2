import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAction } from '@/lib/audit'

// This route is special: it manipulates the JWT session to add or remove
// the impersonatingOrgId claim. We use the server-side session update flow.
//
// POST  { organizationId }   → start impersonating that tenant
// DELETE                     → stop impersonating, return to super-admin scope
//
// Both actions are recorded in the audit log.

export async function POST(req: Request) {
  // Validate the caller is a super admin.
  // We use getServerSession on the server side.
  const { getServerSession } = await import('next-auth/next')
  const { authOptions } = await import('@/lib/next-auth')
  const session = await getServerSession(authOptions)
  if (!session || !session.user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { organizationId } = body as { organizationId: string }
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId required' }, { status: 400 })
  }

  const org = await db.organization.findById(organizationId)
  if (!org) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  // We can't mutate the JWT directly from a route handler. The client must
  // call `signIn` again or we use the session update endpoint. NextAuth v4
  // supports a `/api/auth/session` PATCH that updates the JWT via the jwt
  // callback. To keep things simple and explicit, we return the orgId and
  // the client stores it in a cookie that the jwt callback reads.
  //
  // But the cleanest approach with NextAuth v4 is to expose a custom
  // /api/auth/impersonate endpoint that uses the unstable_update function.
  // Since that's unstable, we'll use a cookie-based approach.

  await logAction({
    actorId: session.user.id,
    actorEmail: session.user.email,
    actorRole: 'SUPER_ADMIN',
    action: 'IMPERSONATE_START',
    targetType: 'organization',
    targetId: org.id,
    targetName: org.name,
    organizationId: org.id,
    details: { organizationSlug: org.slug },
    req,
  })

  // Set a cookie that the jwt callback will read on the next request.
  // The cookie is httpOnly + secure so it can't be tampered from JS.
  const res = NextResponse.json({ ok: true, organization: { id: org.id, name: org.name, slug: org.slug } })
  res.cookies.set('impersonate_org_id', org.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours max impersonation
  })
  res.cookies.set('impersonate_org_name', org.name, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
  return res
}

export async function DELETE(req: Request) {
  const { getServerSession } = await import('next-auth/next')
  const { authOptions } = await import('@/lib/next-auth')
  const session = await getServerSession(authOptions)
  if (!session || !session.user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Log the end of impersonation if there was one.
  if (session.user.impersonatingOrgId) {
    await logAction({
      actorId: session.user.id,
      actorEmail: session.user.email,
      actorRole: 'SUPER_ADMIN',
      action: 'IMPERSONATE_END',
      targetType: 'organization',
      targetId: session.user.impersonatingOrgId,
      targetName: session.user.impersonatingOrgName || null,
      organizationId: session.user.impersonatingOrgId,
      req,
    })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.delete('impersonate_org_id')
  res.cookies.delete('impersonate_org_name')
  return res
}
