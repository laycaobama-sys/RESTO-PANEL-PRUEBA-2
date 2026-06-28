import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !user.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const [stats, activity] = await Promise.all([
    db.superAdmin.getGlobalStats(),
    db.superAdmin.getRecentActivity(20),
  ])
  return NextResponse.json({ stats, activity })
}
