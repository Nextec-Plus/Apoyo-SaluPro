import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { MissingPersonStatus, UpdateMissingPerson } from '@/lib/types/database'

interface StatusChangeBody {
  estado: MissingPersonStatus
  ubicacion_avistamiento?: string
  notas?: string
}

type Ctx = { params: Promise<{ id: string }> }

// Public endpoint — no auth required.
// Changes the estado of a missing person report.
// Optional: provide ubicacion_avistamiento and notas when reporting a sighting.
export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  let body: StatusChangeBody
  try {
    body = await request.json()
  } catch (err) {
    return Response.json(
      { data: null, error: `JSON inválido: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    )
  }

  if (!body.estado) {
    return Response.json({ data: null, error: 'estado es requerido' }, { status: 400 })
  }

  const validStates: MissingPersonStatus[] = [
    'Desaparecido',
    'Avistado',
    'Encontrado',
    'Confirmado Fallecido',
  ]
  if (!validStates.includes(body.estado)) {
    return Response.json(
      { data: null, error: `Estado inválido. Valores permitidos: ${validStates.join(', ')}` },
      { status: 400 },
    )
  }

  // Verify person exists
  const { error: fetchError } = await supabase
    .from('missing_persons')
    .select('id')
    .eq('id', id)
    .single()

  if (fetchError) {
    const status = fetchError.code === 'PGRST116' ? 404 : 500
    return Response.json({ data: null, error: fetchError.message }, { status })
  }

  const update: UpdateMissingPerson = { estado: body.estado }
  if (body.ubicacion_avistamiento) update.ultimo_lugar_visto = body.ubicacion_avistamiento
  if (body.notas) update.informacion_adicional = body.notas
  if (body.estado === 'Confirmado Fallecido') update.fallecimiento_confirmado = true

  const { data, error } = await supabase
    .from('missing_persons')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null })
}
