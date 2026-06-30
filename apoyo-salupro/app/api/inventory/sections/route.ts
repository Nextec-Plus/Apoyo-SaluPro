import { createClient } from '@/lib/supabase/server'

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
