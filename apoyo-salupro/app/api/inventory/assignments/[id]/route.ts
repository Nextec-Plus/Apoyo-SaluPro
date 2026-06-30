import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { UpdateInventoryAssignment } from '@/lib/types/database'

/**
 * PATCH /api/inventory/assignments/[id]
 * Actualiza el estado del despacho (Despachado → Recibido / Cancelado) o sus
 * notas. Cancelar un despacho equivale al borrado lógico: libera el stock
 * (la vista de disponibilidad ignora los cancelados).
 */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/inventory/assignments/[id]'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  let body: UpdateInventoryAssignment
  try {
    body = await request.json()
  } catch (err) {
    return Response.json(
      { data: null, error: `JSON inválido: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    )
  }

  const patch: UpdateInventoryAssignment = {}
  if (body.status !== undefined) patch.status = body.status
  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null

  const { data, error } = await supabase
    .from('inventory_assignments')
    .update(patch)
    .eq('id', id)
    .select(
      '*, material:inventory_materials(id, name, unit), center:inventory_medical_centers(id, name)',
    )
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }
  return Response.json({ data, error: null })
}

/** DELETE /api/inventory/assignments/[id] — cancela el despacho (libera stock). */
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<'/api/inventory/assignments/[id]'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('inventory_assignments')
    .update({ status: 'Cancelado' })
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }
  return Response.json({ data, error: null })
}
