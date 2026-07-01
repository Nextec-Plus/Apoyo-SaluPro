import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/inventory/subcategories
 * Lista todas las subcategorías, opcionalmente filtradas por section_id.
 * Query params: section_id
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { searchParams } = request.nextUrl
  const sectionId = searchParams.get('section_id')

  let query = supabase
    .from('inventory_subcategories')
    .select('*')
    .order('display_order', { ascending: true })

  if (sectionId) query = query.eq('section_id', sectionId)

  const { data, error } = await query
  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null })
}

/**
 * POST /api/inventory/subcategories
 * Crea una nueva subcategoría dentro de una sección.
 * Body: { section_id, code, name }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  let body: { section_id?: string; code?: string; name?: string }
  try { body = await request.json() } catch {
    return Response.json({ data: null, error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.section_id) return Response.json({ data: null, error: 'section_id es requerido' }, { status: 400 })

  const code = body.code?.trim()
  const name = body.name?.trim()
  if (!code) return Response.json({ data: null, error: 'code es requerido' }, { status: 400 })
  if (!name) return Response.json({ data: null, error: 'name es requerido' }, { status: 400 })

  const { data: maxOrder } = await supabase
    .from('inventory_subcategories')
    .select('display_order')
    .eq('section_id', body.section_id)
    .order('display_order', { ascending: false })
    .limit(1)
    .single()

  const displayOrder = (maxOrder?.display_order ?? 0) + 1

  const { data, error } = await supabase
    .from('inventory_subcategories')
    .insert({ section_id: body.section_id, code, name, display_order: displayOrder })
    .select('*')
    .single()

  if (error) {
    const status = error.code === '23505' ? 409 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }
  return Response.json({ data, error: null }, { status: 201 })
}
