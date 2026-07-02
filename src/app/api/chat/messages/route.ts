import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const url = new URL(req.url)
  const channelId = url.searchParams.get('channelId')
  const limit = Number(url.searchParams.get('limit') || '50')

  let q = supabaseAdmin
    .from('chat_messages')
    .select('*')
    .eq('organization_id', user.organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (channelId) q = q.eq('channel_id', channelId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data || []).reverse())
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { channelId, content, priority } = body
  if (!channelId || !content) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      channel_id: channelId,
      user_id: user.id,
      user_name: user.name,
      user_avatar: null,
      content,
      priority: priority || 'normal',
      read_by: [user.id],
      organization_id: user.organizationId,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
