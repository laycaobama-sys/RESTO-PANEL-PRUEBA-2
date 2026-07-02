import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

// POST /api/tables/positions — batch update table positions (drag & drop persistence)
export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { updates } = body as { updates: Array<{ id: string; posX: number; posY: number; zone?: string }> }

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
  }

  // Update each table position — all must belong to the tenant
  const results = []
  for (const u of updates) {
    const patch: any = { pos_x: u.posX, pos_y: u.posY }
    if (u.zone) patch.zone = u.zone
    const { data, error } = await supabaseAdmin
      .from('tables')
      .update(patch)
      .eq('id', u.id)
      .eq('organization_id', user.organizationId)
      .select('id, pos_x, pos_y')
      .single()
    if (error) {
      console.error('Position update error:', error.message)
    } else {
      results.push(data)
    }
  }

  return NextResponse.json({ ok: true, updated: results.length })
}

export async function POST(req: Request) {
  return PATCH(req)
}
