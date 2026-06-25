import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { UpdateCatastropheVictim } from '@/lib/types/database'

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/catastrophe/victims/[id]'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('catastrophe_victims')
    .select('*, catastrophe_victim_info(*), catastrophe_family_contacts(*)')
    .eq('id', id)
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }

  return Response.json({ data, error: null })
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/catastrophe/victims/[id]'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  let body: UpdateCatastropheVictim
  try {
    body = await request.json()
  } catch (err) {
    return Response.json(
      { data: null, error: `JSON inválido: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('catastrophe_victims')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }

  return Response.json({ data, error: null })
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<'/api/catastrophe/victims/[id]'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  const { error } = await supabase
    .from('catastrophe_victims')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data: { id }, error: null })
}
