import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/config'
import type { AssignmentStatus, InsertInventoryAssignment } from '@/lib/types/database'

/**
 * GET /api/inventory/assignments
 * Lista despachos con el nombre del material y del centro médico.
 * Query params:
 *  - material_id, medical_center_id, status: filtros opcionales.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServiceClient()
  const { searchParams } = request.nextUrl

  let query = supabase
    .from('inventory_assignments')
    .select(
      '*, material:inventory_materials(id, name, unit), center:inventory_medical_centers(id, name)',
    )
    .eq('organization_id', getOrganizationId())
    .order('fecha', { ascending: false })
    .limit(500)

  const materialId = searchParams.get('material_id')
  const centerId = searchParams.get('medical_center_id')
  const status = searchParams.get('status')
  if (materialId) query = query.eq('material_id', materialId)
  if (centerId) query = query.eq('medical_center_id', centerId)
  if (status) query = query.eq('status', status as AssignmentStatus)

  const { data, error } = await query
  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null })
}

/** POST /api/inventory/assignments — despacha material a un centro médico. */
export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  let body: Partial<InsertInventoryAssignment>
  try {
    body = await request.json()
  } catch (err) {
    return Response.json(
      { data: null, error: `JSON inválido: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    )
  }

  if (!body.material_id)
    return Response.json({ data: null, error: 'material_id es requerido' }, { status: 400 })
  if (!body.medical_center_id)
    return Response.json({ data: null, error: 'medical_center_id es requerido' }, { status: 400 })

  const quantity = Number(body.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0)
    return Response.json({ data: null, error: 'cantidad inválida' }, { status: 400 })

  // Lógica de negocio: no se puede despachar más de lo disponible.
  const { data: material, error: matError } = await supabase
    .from('inventory_materials_assignment_status')
    .select('name, cantidad_disponible')
    .eq('id', body.material_id)
    .single()

  if (matError) {
    const status = matError.code === 'PGRST116' ? 404 : 500
    return Response.json({ data: null, error: 'Material no encontrado' }, { status })
  }

  const disponible = material.cantidad_disponible ?? 0
  if (quantity > disponible) {
    return Response.json(
      {
        data: null,
        error: `Solo hay ${disponible} disponibles de "${material.name}" (intentó despachar ${quantity}).`,
      },
      { status: 409 },
    )
  }

  const insert: InsertInventoryAssignment = {
    organization_id: getOrganizationId(),
    material_id: body.material_id,
    medical_center_id: body.medical_center_id,
    quantity,
    status: body.status ?? 'Despachado',
    notes: body.notes?.trim() || null,
  }

  const { data, error } = await supabase
    .from('inventory_assignments')
    .insert(insert)
    .select(
      '*, material:inventory_materials(id, name, unit), center:inventory_medical_centers(id, name)',
    )
    .single()

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null }, { status: 201 })
}
