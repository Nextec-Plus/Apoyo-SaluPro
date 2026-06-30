import { createClient } from '@/lib/supabase/server'
import type { SupplyRequestStatus, UpdateSupplyRequest } from '@/lib/types/database'

const VALID_ESTADOS: SupplyRequestStatus[] = [
  'Pendiente', 'En revisión', 'Aprobado', 'Despachado', 'Cerrado',
]

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as { estado?: SupplyRequestStatus; notas?: string }

  if (body.estado && !VALID_ESTADOS.includes(body.estado)) {
    return Response.json({ error: 'Estado inválido.' }, { status: 400 })
  }

  const patch: UpdateSupplyRequest = {}
  if (body.estado) patch.estado = body.estado
  if (body.notas !== undefined) patch.notas = body.notas

  const { data, error } = await supabase
    .from('supply_requests')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data, error: null })
}
