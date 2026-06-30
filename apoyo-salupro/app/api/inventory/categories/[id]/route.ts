import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { UpdateInventoryCategory } from '@/lib/types/database'

/** PATCH /api/inventory/categories/[id] — edita una categoría/subcategoría. */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/inventory/categories/[id]'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  let body: UpdateInventoryCategory
  try {
    body = await request.json()
  } catch (err) {
    return Response.json(
      { data: null, error: `JSON inválido: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    )
  }

  // Campos editables (no se permite mover de organización).
  const patch: UpdateInventoryCategory = {}
  if (body.name !== undefined) patch.name = body.name?.trim()
  if (body.code !== undefined) patch.code = body.code?.trim() || null
  if (body.description !== undefined) patch.description = body.description?.trim() || null
  if (body.location_id !== undefined) patch.location_id = body.location_id ?? null
  if (body.is_active !== undefined) patch.is_active = body.is_active

  const { data, error } = await supabase
    .from('inventory_categories')
    .update(patch)
    .eq('id', id)
    .select('*, location:inventory_locations(id, name)')
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : error.code === '23505' ? 409 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }
  return Response.json({ data, error: null })
}

/** DELETE /api/inventory/categories/[id] — desactivación lógica (no borra). */
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<'/api/inventory/categories/[id]'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('inventory_categories')
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
