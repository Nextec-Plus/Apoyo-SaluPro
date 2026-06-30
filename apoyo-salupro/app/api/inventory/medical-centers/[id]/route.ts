import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { UpdateInventoryMedicalCenter } from '@/lib/types/database'

/** PATCH /api/inventory/medical-centers/[id] — edita un centro médico. */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/inventory/medical-centers/[id]'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  let body: UpdateInventoryMedicalCenter
  try {
    body = await request.json()
  } catch (err) {
    return Response.json(
      { data: null, error: `JSON inválido: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    )
  }

  const patch: UpdateInventoryMedicalCenter = {}
  if (body.name !== undefined) patch.name = body.name?.trim()
  if (body.location !== undefined) patch.location = body.location?.trim() || null
  if (body.contact !== undefined) patch.contact = body.contact?.trim() || null
  if (body.phone !== undefined) patch.phone = body.phone?.trim() || null
  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null
  if (body.is_active !== undefined) patch.is_active = body.is_active

  const { data, error } = await supabase
    .from('inventory_medical_centers')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : error.code === '23505' ? 409 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }
  return Response.json({ data, error: null })
}

/** DELETE /api/inventory/medical-centers/[id] — desactivación lógica. */
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<'/api/inventory/medical-centers/[id]'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('inventory_medical_centers')
    .update({ is_active: false })
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }
  return Response.json({ data, error: null })
}
