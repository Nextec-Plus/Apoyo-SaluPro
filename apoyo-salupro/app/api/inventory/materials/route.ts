import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/config'
import type { InsertInventoryMaterial } from '@/lib/types/database'

/**
 * GET /api/inventory/materials
 * Lista materiales con su estado de stock (vista de asignación).
 * Query params:
 *  - search     : ilike sobre el nombre (sirve para el autocompletado)
 *  - category_id: filtra por subcategoría
 *  - limit      : tope de filas (default 200; el autocompletado usa ~8)
 */
export async function GET(request: NextRequest) {
  const supabase = await createServiceClient()
  const { searchParams } = request.nextUrl
  const search = searchParams.get('search')?.trim()
  const categoryId = searchParams.get('category_id')
  const limit = Math.max(1, Math.min(500, Number(searchParams.get('limit')) || 200))

  let query = supabase
    .from('inventory_materials_assignment_status')
    .select('*')
    .eq('organization_id', getOrganizationId())
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(limit)

  if (search) query = query.ilike('name', `%${search}%`)
  if (categoryId) query = query.eq('category_id', categoryId)

  const { data, error } = await query
  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null })
}

/** POST /api/inventory/materials — registra un material (carga consecutiva). */
export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  let body: Partial<InsertInventoryMaterial>
  try {
    body = await request.json()
  } catch (err) {
    return Response.json(
      { data: null, error: `JSON inválido: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    )
  }

  const name = body.name?.trim()
  if (!name) return Response.json({ data: null, error: 'name es requerido' }, { status: 400 })

  const stock = Number(body.stock ?? 0)
  if (!Number.isFinite(stock) || stock < 0)
    return Response.json({ data: null, error: 'stock inválido' }, { status: 400 })

  const insert: InsertInventoryMaterial = {
    organization_id: getOrganizationId(),
    name,
    category_id: body.category_id ?? null,
    description: body.description?.trim() || null,
    unit: body.unit?.trim() || null,
    stock,
  }

  const { data, error } = await supabase
    .from('inventory_materials')
    .insert(insert)
    .select('*')
    .single()

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null }, { status: 201 })
}
