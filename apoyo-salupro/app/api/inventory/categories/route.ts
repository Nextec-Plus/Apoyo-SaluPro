import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/config'
import type { InsertInventoryCategory } from '@/lib/types/database'

/**
 * GET /api/inventory/categories
 * Devuelve las categorías activas (planas) con el nombre de su localización.
 * El cliente las agrupa en árbol (categoría → subcategorías) usando parent_id.
 */
export async function GET() {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('inventory_categories')
    .select('*, location:inventory_locations(id, name)')
    .eq('organization_id', getOrganizationId())
    .eq('is_active', true)
    .order('code', { ascending: true })

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null })
}

/** POST /api/inventory/categories — crea una categoría o subcategoría. */
export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  let body: Partial<InsertInventoryCategory>
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

  const insert: InsertInventoryCategory = {
    organization_id: getOrganizationId(),
    name,
    code: body.code?.trim() || null,
    description: body.description?.trim() || null,
    parent_id: body.parent_id ?? null,
    location_id: body.location_id ?? null,
  }

  const { data, error } = await supabase
    .from('inventory_categories')
    .insert(insert)
    .select('*, location:inventory_locations(id, name)')
    .single()

  if (error) {
    const status = error.code === '23505' ? 409 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }
  return Response.json({ data, error: null }, { status: 201 })
}
