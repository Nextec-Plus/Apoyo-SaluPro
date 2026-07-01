import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateUniqueCode } from '@/lib/inventory/generate-code'

/**
 * GET /api/inventory/sections
 * Devuelve las 12 secciones globales con sus subcategorías anidadas.
 * Lectura pública para cualquier usuario autenticado (RLS lo permite).
 */
export async function GET() {
  const supabase = await createClient()

  const { data: sections, error: secErr } = await supabase
    .from('inventory_sections')
    .select('*')
    .order('display_order', { ascending: true })

  if (secErr) return Response.json({ data: null, error: secErr.message }, { status: 500 })

  const { data: subcats, error: subErr } = await supabase
    .from('inventory_subcategories')
    .select('*')
    .order('display_order', { ascending: true })

  if (subErr) return Response.json({ data: null, error: subErr.message }, { status: 500 })

  const result = (sections ?? []).map((s) => ({
    ...s,
    subcategories: (subcats ?? []).filter((sc) => sc.section_id === s.id),
  }))

  return Response.json({ data: result, error: null })
}

/**
 * POST /api/inventory/sections
 * Crea una nueva sección (categoría global). El código se genera a partir del nombre.
 * Body: { name }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  let body: { name?: string }
  try { body = await request.json() } catch {
    return Response.json({ data: null, error: 'JSON inválido' }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) return Response.json({ data: null, error: 'name es requerido' }, { status: 400 })

  const code = await generateUniqueCode(supabase, 'inventory_sections', name)

  const { data: maxOrder } = await supabase
    .from('inventory_sections')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .single()

  const displayOrder = (maxOrder?.display_order ?? 0) + 1

  const { data, error } = await supabase
    .from('inventory_sections')
    .insert({ code, name, display_order: displayOrder })
    .select('*')
    .single()

  if (error) {
    const status = error.code === '23505' ? 409 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }
  return Response.json({ data, error: null }, { status: 201 })
}
