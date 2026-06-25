import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { CareState } from '@/lib/types/database'

interface UpdateCaseBody {
  estado_destino?: CareState
  motivo_principal_consulta?: string
  condiciones_preexistentes?: string
  alergias?: string
  tratamiento_medicamentos?: string
}

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/catastrophe/cases/[id]'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('catastrophe_victim_info')
    .select('*, catastrophe_victims(*, catastrophe_family_contacts(*))')
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
  ctx: RouteContext<'/api/catastrophe/cases/[id]'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  let body: UpdateCaseBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ data: null, error: 'Body inválido' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('catastrophe_victim_info')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(body as any)
    .eq('id', id)
    .select('*, catastrophe_victims(*)')
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }

  return Response.json({ data, error: null })
}
