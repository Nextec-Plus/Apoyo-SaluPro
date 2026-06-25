import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { CareState, TriageCategory } from '@/lib/types/database'

interface CreateCaseBody {
  organization_id: string
  victim_id: string
  triage_category: TriageCategory
  motivo_principal_consulta?: string
  condiciones_preexistentes?: string
  alergias?: string
  tratamiento_medicamentos?: string
}

export async function GET(request: NextRequest) {
  const supabase = await createServiceClient()
  const { searchParams } = request.nextUrl

  const organization_id = searchParams.get('organization_id')
  const estado_destino = searchParams.get('estado_destino') as CareState | null
  const triage_category = searchParams.get('triage_category') as TriageCategory | null
  const fecha_inicio = searchParams.get('fecha_inicio')
  const fecha_fin = searchParams.get('fecha_fin')

  if (!organization_id) {
    return Response.json({ data: null, error: 'organization_id requerido' }, { status: 400 })
  }

  let query = supabase
    .from('catastrophe_victim_info')
    .select('*, catastrophe_victims(*)')
    .eq('organization_id', organization_id)
    .order('fecha_hora_entrada', { ascending: false })

  if (estado_destino) query = query.eq('estado_destino', estado_destino)
  if (triage_category) query = query.eq('triage_category', triage_category)
  if (fecha_inicio) query = query.gte('fecha_hora_entrada', fecha_inicio)
  if (fecha_fin) query = query.lte('fecha_hora_entrada', fecha_fin)

  const { data, error } = await query

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null })
}

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  let body: CreateCaseBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ data: null, error: 'Body inválido' }, { status: 400 })
  }

  if (!body.organization_id || !body.victim_id || !body.triage_category) {
    return Response.json(
      { data: null, error: 'organization_id, victim_id y triage_category son requeridos' },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('catastrophe_victim_info')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      organization_id: body.organization_id,
      victim_id: body.victim_id,
      triage_category: body.triage_category,
      motivo_principal_consulta: body.motivo_principal_consulta ?? null,
      condiciones_preexistentes: body.condiciones_preexistentes ?? null,
      alergias: body.alergias ?? null,
      tratamiento_medicamentos: body.tratamiento_medicamentos ?? null,
      estado_destino: 'Triaje',
      fecha_hora_entrada: new Date().toISOString(),
    } as any)
    .select('*, catastrophe_victims(*)')
    .single()

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null }, { status: 201 })
}
