import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/config'
import type { InsertInventoryMedicalCenter } from '@/lib/types/database'

/** GET /api/inventory/medical-centers — centros médicos receptores. */
export async function GET() {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('inventory_medical_centers')
    .select('*')
    .eq('organization_id', getOrganizationId())
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null })
}

/** POST /api/inventory/medical-centers — crea un centro médico. */
export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  let body: Partial<InsertInventoryMedicalCenter>
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

  const insert: InsertInventoryMedicalCenter = {
    organization_id: getOrganizationId(),
    name,
    location: body.location?.trim() || null,
    contact: body.contact?.trim() || null,
    phone: body.phone?.trim() || null,
    notes: body.notes?.trim() || null,
  }

  const { data, error } = await supabase
    .from('inventory_medical_centers')
    .insert(insert)
    .select('*')
    .single()

  if (error) {
    const status = error.code === '23505' ? 409 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }
  return Response.json({ data, error: null }, { status: 201 })
}
