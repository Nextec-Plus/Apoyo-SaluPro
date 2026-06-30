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
 * Lista los artículos del centro con sección, subcategoría, ubicación y stock.
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
      ),
      location:inventory_locations(id, name)
    `)
    .eq('acopio_center_id', centerId)
    .order('created_at', { ascending: true })

  if (subcategoryId) query = query.eq('subcategory_id', subcategoryId)
  if (search) query = query.ilike('presentacion', `%${search}%`)

  const { data, error } = await query
  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })

  // Filtro de sección en memoria (Supabase no soporta filtro en relaciones anidadas con .eq)
  const filtered = sectionId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (data ?? []).filter((it: any) => it.subcategory?.section?.id === sectionId)
    : data ?? []

  return Response.json({ data: filtered, error: null })
}

/**
 * POST /api/inventory/items
 * Registra un nuevo artículo en el centro.
 * Body: { subcategory_id, presentacion, location_id? }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const centerId = await getCenterId(supabase)
  if (!centerId) return Response.json({ data: null, error: 'Sin asignación de centro' }, { status: 403 })

  let body: { subcategory_id?: string; presentacion?: string; location_id?: string | null }
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
      location_id: body.location_id ?? null,
    })
    .select(`
      *,
      subcategory:inventory_subcategories(
        id, code, name,
        section:inventory_sections(id, code, name)
      ),
      location:inventory_locations(id, name)
    `)
    .single()

  if (error) {
    const status = error.code === '23505' ? 409 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }
  return Response.json({ data, error: null }, { status: 201 })
}
