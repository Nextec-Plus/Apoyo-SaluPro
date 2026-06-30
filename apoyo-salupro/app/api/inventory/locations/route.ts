import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/config'
import type { InsertInventoryLocation } from '@/lib/types/database'

/** GET /api/inventory/locations — secciones físicas del almacén. */
export async function GET() {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('inventory_locations')
    .select('*')
    .eq('organization_id', getOrganizationId())
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null })
}

/** POST /api/inventory/locations — crea una sección. */
export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  let body: Partial<InsertInventoryLocation>
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

  const { data, error } = await supabase
    .from('inventory_locations')
    .insert({ name, organization_id: getOrganizationId() })
    .select()
    .single()

  if (error) {
    const status = error.code === '23505' ? 409 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }
  return Response.json({ data, error: null }, { status: 201 })
}
