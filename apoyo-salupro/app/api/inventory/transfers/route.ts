import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getCenterAndUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { userId: null, centerId: null }
  const { data } = await supabase
    .from('acopio_user_assignments')
    .select('acopio_center_id')
    .eq('user_id', user.id)
    .single()
  return { userId: user.id, centerId: data?.acopio_center_id ?? null }
}

/**
 * POST /api/inventory/transfers
 * Traslada uno o varios artículos de una ubicación a otra en una sola
 * operación atómica (todo o nada) vía el RPC transfer_inventory_stock.
 * Body: { location_origen_id, location_destino_id, items: { item_id, cantidad }[], nota? }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { userId, centerId } = await getCenterAndUser(supabase)
  if (!centerId || !userId) return Response.json({ data: null, error: 'Sin asignación de centro' }, { status: 403 })

  let body: {
    location_origen_id?: string
    location_destino_id?: string
    items?: { item_id?: string; cantidad?: number }[]
    nota?: string | null
  }
  try { body = await request.json() } catch {
    return Response.json({ data: null, error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.location_origen_id || !body.location_destino_id)
    return Response.json({ data: null, error: 'Debe indicar ubicación origen y destino' }, { status: 400 })
  if (body.location_origen_id === body.location_destino_id)
    return Response.json({ data: null, error: 'La ubicación origen y destino no pueden ser la misma' }, { status: 400 })
  if (!Array.isArray(body.items) || body.items.length === 0)
    return Response.json({ data: null, error: 'Debe indicar al menos un artículo para trasladar' }, { status: 400 })

  const itemIds: string[] = []
  const cantidades: number[] = []
  for (const line of body.items) {
    if (!line.item_id) return Response.json({ data: null, error: 'item_id es requerido en cada línea' }, { status: 400 })
    const cant = Number(line.cantidad)
    if (!Number.isFinite(cant) || cant <= 0)
      return Response.json({ data: null, error: `Cantidad inválida para el artículo ${line.item_id}` }, { status: 400 })
    itemIds.push(line.item_id)
    cantidades.push(cant)
  }

  const { error } = await supabase.rpc('transfer_inventory_stock', {
    p_item_ids: itemIds,
    p_cantidades: cantidades,
    p_origen: body.location_origen_id,
    p_destino: body.location_destino_id,
    p_center: centerId,
    p_user: userId,
    p_nota: body.nota?.trim() || null,
  })

  if (error) {
    const status = error.message.includes('Stock insuficiente') ? 409 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }
  return Response.json({ data: { count: itemIds.length }, error: null }, { status: 201 })
}
