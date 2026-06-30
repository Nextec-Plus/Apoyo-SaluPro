import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { CareState, TriageCategory } from '@/lib/types/database'

interface UpdateCaseBody {
  triage_category?: TriageCategory
  estado_destino?: CareState
  motivo_principal_consulta?: string
  condiciones_preexistentes?: string
  alergias?: string
  tratamiento_medicamentos?: string
  /** Actualiza catastrophe_victims.notas en la misma operación (p. ej. alta/traslado). */
  notas?: string | null
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
  } catch (err) {
    return Response.json(
      { data: null, error: `JSON inválido: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    )
  }

  const { notas, ...caseFields } = body

  const { data: existing, error: fetchError } = await supabase
    .from('catastrophe_victim_info')
    .select('victim_id')
    .eq('id', id)
    .single()

  if (fetchError) {
    const status = fetchError.code === 'PGRST116' ? 404 : 500
    return Response.json({ data: null, error: fetchError.message }, { status })
  }

  let previousNotas: string | null | undefined
  if (notas !== undefined) {
    const { data: victim, error: victimFetchError } = await supabase
      .from('catastrophe_victims')
      .select('notas')
      .eq('id', existing.victim_id)
      .single()

    if (victimFetchError) {
      const status = victimFetchError.code === 'PGRST116' ? 404 : 500
      return Response.json({ data: null, error: victimFetchError.message }, { status })
    }

    previousNotas = victim.notas

    const { error: victimUpdateError } = await supabase
      .from('catastrophe_victims')
      .update({ notas })
      .eq('id', existing.victim_id)

    if (victimUpdateError) {
      return Response.json({ data: null, error: victimUpdateError.message }, { status: 500 })
    }
  }

  const { data, error } = await supabase
    .from('catastrophe_victim_info')
    .update(caseFields)
    .eq('id', id)
    .select('*, catastrophe_victims(*)')
    .single()

  if (error) {
    if (notas !== undefined && previousNotas !== undefined) {
      await supabase
        .from('catastrophe_victims')
        .update({ notas: previousNotas })
        .eq('id', existing.victim_id)
    }
    const status = error.code === 'PGRST116' ? 404 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }

  return Response.json({ data, error: null })
}
