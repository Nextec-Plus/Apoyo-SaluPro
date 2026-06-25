import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { InsertCatastropheVictimInfo, UpdateCatastropheVictimInfo } from '@/lib/types/database'

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/catastrophe/victims/[id]/info'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('catastrophe_victim_info')
    .select('*')
    .eq('victim_id', id)
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }

  return Response.json({ data, error: null })
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/catastrophe/victims/[id]/info'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  let body: Omit<InsertCatastropheVictimInfo, 'victim_id'>
  try {
    body = await request.json()
  } catch {
    return Response.json({ data: null, error: 'Body inválido' }, { status: 400 })
  }

  if (!body.triage_category || !body.organization_id) {
    return Response.json(
      { data: null, error: 'triage_category y organization_id son requeridos' },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('catastrophe_victim_info')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert({ ...body, victim_id: id } as any, { onConflict: 'victim_id' })
    .select()
    .single()

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null }, { status: 201 })
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/catastrophe/victims/[id]/info'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  let body: UpdateCatastropheVictimInfo
  try {
    body = await request.json()
  } catch {
    return Response.json({ data: null, error: 'Body inválido' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('catastrophe_victim_info')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(body as any)
    .eq('victim_id', id)
    .select()
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }

  return Response.json({ data, error: null })
}
