import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { InventoryMovementType } from '@/lib/types/database'

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
 * GET /api/inventory/movements
 * Kardex del centro. Query params: item_id, tipo, limit (default 200).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { centerId } = await getCenterAndUser(supabase)
  if (!centerId) return Response.json({ data: null, error: 'Sin asignación de centro' }, { status: 403 })

  const { searchParams } = request.nextUrl
  const itemId = searchParams.get('item_id')
  const tipo = searchParams.get('tipo') as InventoryMovementType | null
  const limit = Math.max(1, Math.min(500, Number(searchParams.get('limit')) || 200))

  let query = supabase
    .from('inventory_movements')
    .select(`
      *,
      item:inventory_items(
        id, presentacion, stock,
        subcategory:inventory_subcategories(id, name, section:inventory_sections(id, name))
      ),
      location:inventory_locations(id, name)
    `)
    .eq('acopio_center_id', centerId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (itemId) query = query.eq('item_id', itemId)
  if (tipo) query = query.eq('tipo', tipo)

  const { data, error } = await query
  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null })
}

/**
 * POST /api/inventory/movements
 * Registra una entrada o salida en una ubicación específica. El trigger
 * actualiza el stock de esa ubicación (y el total cacheado del artículo)
 * atómicamente, por lo que un artículo puede tener stock en N ubicaciones.
 * Body: { item_id, tipo, cantidad, location_id, entregado_por?, destinatario?, medio_transporte?, nota? }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { userId, centerId } = await getCenterAndUser(supabase)
  if (!centerId || !userId) return Response.json({ data: null, error: 'Sin asignación de centro' }, { status: 403 })

  let body: {
    item_id?: string
    tipo?: InventoryMovementType
    cantidad?: number
    location_id?: string | null
    entregado_por?: string | null
    destinatario?: string | null
    medio_transporte?: string | null
    nota?: string | null
  }
  try { body = await request.json() } catch {
    return Response.json({ data: null, error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.item_id)
    return Response.json({ data: null, error: 'item_id es requerido' }, { status: 400 })
  if (!body.tipo || !['entrada', 'salida'].includes(body.tipo))
    return Response.json({ data: null, error: 'tipo debe ser "entrada" o "salida"' }, { status: 400 })
  if (!body.location_id)
    return Response.json({ data: null, error: 'location_id es requerido' }, { status: 400 })

  const cantidad = Number(body.cantidad)
  if (!Number.isFinite(cantidad) || cantidad <= 0)
    return Response.json({ data: null, error: 'cantidad debe ser mayor a 0' }, { status: 400 })

  const { data, error } = await supabase
    .from('inventory_movements')
    .insert({
      acopio_center_id: centerId,
      item_id: body.item_id,
      tipo: body.tipo,
      cantidad,
      location_id: body.location_id,
      entregado_por: body.entregado_por?.trim() || null,
      destinatario: body.destinatario?.trim() || null,
      medio_transporte: body.medio_transporte?.trim() || null,
      nota: body.nota?.trim() || null,
      created_by: userId,
    })
    .select()
    .single()

  if (error) {
    // El trigger lanza excepciones con mensajes descriptivos (stock insuficiente, etc.)
    const status = error.message.includes('Stock insuficiente') ? 409 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }
  return Response.json({ data, error: null }, { status: 201 })
}
