import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getCenterId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('acopio_user_assignments')
    .select('acopio_center_id')
    .eq('user_id', user.id)
    .single()
  return data?.acopio_center_id ?? null
}

/**
 * PATCH /api/inventory/items/[id]
 * Actualiza presentación o ubicación de un artículo.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const centerId = await getCenterId(supabase)
  if (!centerId) return Response.json({ data: null, error: 'Sin asignación de centro' }, { status: 403 })

  let body: { presentacion?: string; location_id?: string | null }
  try { body = await request.json() } catch {
    return Response.json({ data: null, error: 'JSON inválido' }, { status: 400 })
  }

  const patch: { presentacion?: string; location_id?: string | null } = {}
  if (body.presentacion !== undefined) patch.presentacion = body.presentacion.trim()
  if (body.location_id !== undefined) patch.location_id = body.location_id

  if (Object.keys(patch).length === 0)
    return Response.json({ data: null, error: 'Sin campos para actualizar' }, { status: 400 })

  const { data, error } = await supabase
    .from('inventory_items')
    .update(patch)
    .eq('id', id)
    .eq('acopio_center_id', centerId)
    .select()
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : error.code === '23505' ? 409 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }
  return Response.json({ data, error: null })
}

/**
 * DELETE /api/inventory/items/[id]
 * Elimina un artículo solo si no tiene movimientos registrados.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const centerId = await getCenterId(supabase)
  if (!centerId) return Response.json({ data: null, error: 'Sin asignación de centro' }, { status: 403 })

  const { count } = await supabase
    .from('inventory_movements')
    .select('id', { count: 'exact', head: true })
    .eq('item_id', id)

  if ((count ?? 0) > 0)
    return Response.json(
      { data: null, error: 'No se puede eliminar: tiene movimientos registrados.' },
      { status: 409 },
    )

  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', id)
    .eq('acopio_center_id', centerId)

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data: null, error: null })
}
