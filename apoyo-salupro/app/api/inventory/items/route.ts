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
 * GET /api/inventory/items
 * Lista los artículos del centro con sección, subcategoría, stock por ubicación y stock total.
 * Query params:
 *  - section_id    : filtra por sección
 *  - subcategory_id: filtra por subcategoría
 *  - search        : ilike sobre presentación
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const centerId = await getCenterId(supabase)
  if (!centerId) return Response.json({ data: null, error: 'Sin asignación de centro' }, { status: 403 })

  const { searchParams } = request.nextUrl
  const sectionId = searchParams.get('section_id')
  const subcategoryId = searchParams.get('subcategory_id')
  const search = searchParams.get('search')?.trim()

  let query = supabase
    .from('inventory_items')
    .select(`
      *,
      subcategory:inventory_subcategories(
        id, code, name, description, display_order,
        section:inventory_sections(id, code, name, display_order)
      )
    `)
    .eq('acopio_center_id', centerId)
    .order('created_at', { ascending: true })

  if (subcategoryId) query = query.eq('subcategory_id', subcategoryId)
  if (search) query = query.ilike('presentacion', `%${search}%`)

  const { data, error } = await query
  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })

  const { data: stockRows, error: stockError } = await supabase
    .from('inventory_item_stock')
    .select('item_id, stock, location:inventory_locations(id, name)')
    .eq('acopio_center_id', centerId)

  if (stockError) return Response.json({ data: null, error: stockError.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stockByItem = new Map<string, any[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (stockRows ?? []) as any[]) {
    const list = stockByItem.get(row.item_id) ?? []
    list.push({ location_id: row.location?.id ?? null, location_name: row.location?.name ?? '—', stock: row.stock })
    stockByItem.set(row.item_id, list)
  }

  const withStock = (data ?? []).map((it) => ({ ...it, stock_locations: stockByItem.get(it.id) ?? [] }))

  // Filtro de sección en memoria (Supabase no soporta filtro en relaciones anidadas con .eq)
  const filtered = sectionId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? withStock.filter((it: any) => it.subcategory?.section?.id === sectionId)
    : withStock

  return Response.json({ data: filtered, error: null })
}

/**
 * POST /api/inventory/items
 * Registra un nuevo artículo en el centro. El stock se asigna a ubicaciones
 * específicas mediante movimientos (ver /api/inventory/movements), por lo
 * que el artículo nace sin ubicación fija y puede llegar a tener stock en
 * varias a la vez.
 * Body: { subcategory_id, presentacion }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const centerId = await getCenterId(supabase)
  if (!centerId) return Response.json({ data: null, error: 'Sin asignación de centro' }, { status: 403 })

  let body: { subcategory_id?: string; presentacion?: string }
  try { body = await request.json() } catch {
    return Response.json({ data: null, error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.subcategory_id)
    return Response.json({ data: null, error: 'subcategory_id es requerido' }, { status: 400 })

  const presentacion = body.presentacion?.trim()
  if (!presentacion)
    return Response.json({ data: null, error: 'presentacion es requerida' }, { status: 400 })

  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      acopio_center_id: centerId,
      subcategory_id: body.subcategory_id,
      presentacion,
    })
    .select(`
      *,
      subcategory:inventory_subcategories(
        id, code, name,
        section:inventory_sections(id, code, name)
      )
    `)
    .single()

  if (error) {
    const status = error.code === '23505' ? 409 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }
  return Response.json({ data: { ...data, stock_locations: [] }, error: null }, { status: 201 })
}
