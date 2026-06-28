import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const url = new URL(req.url)
  const limit = Number(url.searchParams.get('limit') || '100')
  const action = url.searchParams.get('action') || undefined
  const logs = await db.auditLogs.list({ limit, action })
  return NextResponse.json(logs)
}
