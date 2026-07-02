import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/session'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('chat_channels')
    .select('*')
    .eq('organization_id', user.organizationId)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!data || data.length === 0) {
    const defaults = [
      { name: 'General', slug: 'general', icon: '💬', sort_order: 1 },
      { name: 'Cocina', slug: 'cocina', icon: '👨‍🍳', sort_order: 2 },
      { name: 'Barra', slug: 'barra', icon: '🍸', sort_order: 3 },
      { name: 'Sala', slug: 'sala', icon: '🍽️', sort_order: 4 },
      { name: 'Eventos', slug: 'eventos', icon: '🎉', sort_order: 5 },
    ]
    const { data: created } = await supabaseAdmin
      .from('chat_channels')
      .insert(defaults.map(d => ({ ...d, organization_id: user.organizationId })))
      .select()
    return NextResponse.json(created || [])
  }

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json()
  const { name, icon } = body
  if (!name) return NextResponse.json({ error: 'Nombre obligatorio' }, { status: 400 })

  const slug = name.toLowerCase().replace(/\s+/g, '-')
  const { data, error } = await supabaseAdmin
    .from('chat_channels')
    .insert({ name, slug, icon: icon || '💬', organization_id: user.organizationId })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
