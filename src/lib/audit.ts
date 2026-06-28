import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

/**
 * Records an entry in the audit log.
 *
 * Used by every privileged action: super-admin impersonation,
 * tenant suspension, role changes, etc. The audit log is the
 * single source of truth for "who did what, when, on which tenant".
 *
 * Records never expire and are never auto-deleted. They can only
 * be removed manually via a SQL query by the database owner.
 */
export async function logAction(input: {
  actorId: string
  actorEmail: string
  actorRole: string
  action: string
  targetType?: string | null
  targetId?: string | null
  targetName?: string | null
  organizationId?: string | null
  details?: any
  req?: NextRequest | Request
}) {
  const ip = input.req
    ? (input.req as NextRequest).headers.get('x-forwarded-for') ||
      (input.req as NextRequest).headers.get('x-real-ip') ||
      null
    : null
  const ua = input.req ? (input.req as NextRequest).headers.get('user-agent') : null

  await db.auditLogs.insert({
    actor_id: input.actorId,
    actor_email: input.actorEmail,
    actor_role: input.actorRole,
    action: input.action,
    target_type: input.targetType || null,
    target_id: input.targetId || null,
    target_name: input.targetName || null,
    organization_id: input.organizationId || null,
    details: input.details || null,
    ip_address: ip,
    user_agent: ua,
  })
}
