import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { UpdateCatastropheCareRequirement } from '@/lib/types/database'

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/catastrophe/care-requirements/[id]'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  let body: UpdateCatastropheCareRequirement
  try {
    body = await request.json()
  } catch {
    return Response.json({ data: null, error: 'Body inválido' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('catastrophe_care_requirements')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(body as any)
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
  ctx: RouteContext<'/api/catastrophe/care-requirements/[id]'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  const { error } = await supabase
    .from('catastrophe_care_requirements')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data: { id }, error: null })
}
