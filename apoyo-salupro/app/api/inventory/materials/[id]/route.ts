import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { UpdateInventoryMaterial } from '@/lib/types/database'

/** PATCH /api/inventory/materials/[id] — edita un material. */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/inventory/materials/[id]'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  let body: UpdateInventoryMaterial
  try {
    body = await request.json()
  } catch (err) {
    return Response.json(
      { data: null, error: `JSON inválido: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    )
  }

  const patch: UpdateInventoryMaterial = {}
  if (body.name !== undefined) patch.name = body.name?.trim()
  if (body.category_id !== undefined) patch.category_id = body.category_id ?? null
  if (body.description !== undefined) patch.description = body.description?.trim() || null
  if (body.unit !== undefined) patch.unit = body.unit?.trim() || null
  if (body.stock !== undefined) {
    const stock = Number(body.stock)
    if (!Number.isFinite(stock) || stock < 0)
      return Response.json({ data: null, error: 'stock inválido' }, { status: 400 })
    patch.stock = stock
  }
  if (body.is_active !== undefined) patch.is_active = body.is_active

  const { data, error } = await supabase
    .from('inventory_materials')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }
  return Response.json({ data, error: null })
}

/** DELETE /api/inventory/materials/[id] — desactivación lógica (no borra). */
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<'/api/inventory/materials/[id]'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('inventory_materials')
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
