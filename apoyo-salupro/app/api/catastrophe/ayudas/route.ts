import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

/**
 * GET /api/catastrophe/ayudas
 * Lista entregas de ayuda con sus items (incluye nombre del tipo). Filtros:
 * organization_id (requerido), cedula (búsqueda parcial), nombre (búsqueda
 * parcial), tipo_id (solo entregas que incluyan ese tipo), limit/cursor.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServiceClient()
  const { searchParams } = request.nextUrl

  const organization_id = searchParams.get('organization_id')
  const cedula = searchParams.get('cedula')
  const nombre = searchParams.get('nombre')
  const tipoId = searchParams.get('tipo_id')
  const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit')) || 25))
  const cursor = searchParams.get('cursor')

  if (!organization_id) {
    return Response.json({ data: null, error: 'organization_id es requerido' }, { status: 400 })
  }

  // !inner cuando filtramos por tipo_id → PostgREST descarta entregas que no
  // tengan ningún item de ese tipo (un LEFT JOIN normal no lo hace).
  const itemsJoin = tipoId
    ? 'ayuda_entrega_items!inner(*, ayuda_tipos(id, nombre))'
    : 'ayuda_entrega_items(*, ayuda_tipos(id, nombre))'

  let query = supabase
    .from('ayuda_entregas')
    .select(`*, ${itemsJoin}`)
    .eq('organization_id', organization_id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)

  if (cedula) query = query.ilike('cedula', `%${onlyDigits(cedula)}%`)
  if (nombre) query = query.ilike('nombre_completo', `%${nombre.trim()}%`)
  if (tipoId) query = query.eq('ayuda_entrega_items.tipo_id', tipoId)
  if (cursor) {
    const sep = cursor.lastIndexOf(',')
    if (sep > 0) {
      const cursorDate = cursor.slice(0, sep)
      const cursorId = cursor.slice(sep + 1)
      query = query.or(`created_at.lt.${cursorDate},and(created_at.eq.${cursorDate},id.lt.${cursorId})`)
    }
  }

  const { data, error } = await query
  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })

  const last = data?.[data.length - 1]
  const next_cursor = data && data.length === limit && last ? `${last.created_at},${last.id}` : null

  return Response.json({ data, next_cursor, has_more: next_cursor !== null, error: null })
}

/**
 * POST /api/catastrophe/ayudas
 * Registra una entrega de ayuda (cédula + nombre + N tipos de ayuda con
 * cantidad) vía RPC atómico create_ayuda_entrega. La cédula se normaliza a
 * solo dígitos antes de guardar.
 * Body: { organization_id, cedula, nombre_completo, items: { tipo_id, cantidad }[] }
 */
export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  let body: {
    organization_id?: string
    cedula?: string
    nombre_completo?: string
    items?: { tipo_id?: string; cantidad?: number }[]
  }
  try { body = await request.json() } catch {
    return Response.json({ data: null, error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.organization_id)
    return Response.json({ data: null, error: 'organization_id es requerido' }, { status: 400 })
  const cedula = body.cedula ? onlyDigits(body.cedula) : ''
  if (!cedula)
    return Response.json({ data: null, error: 'La cédula es requerida (solo números)' }, { status: 400 })
  const nombre_completo = body.nombre_completo?.trim()
  if (!nombre_completo)
    return Response.json({ data: null, error: 'El nombre completo es requerido' }, { status: 400 })
  if (!Array.isArray(body.items) || body.items.length === 0)
    return Response.json({ data: null, error: 'Debe indicar al menos una ayuda entregada' }, { status: 400 })

  const tipoIds: string[] = []
  const cantidades: number[] = []
  for (const line of body.items) {
    if (!line.tipo_id)
      return Response.json({ data: null, error: 'tipo_id es requerido en cada línea' }, { status: 400 })
    const cant = Number(line.cantidad)
    if (!Number.isFinite(cant) || cant <= 0)
      return Response.json({ data: null, error: `Cantidad inválida para el tipo ${line.tipo_id}` }, { status: 400 })
    tipoIds.push(line.tipo_id)
    cantidades.push(cant)
  }

  const { data, error } = await supabase.rpc('create_ayuda_entrega', {
    p_organization_id: body.organization_id,
    p_cedula: cedula,
    p_nombre_completo: nombre_completo,
    p_tipo_ids: tipoIds,
    p_cantidades: cantidades,
  })

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data: { id: data }, error: null }, { status: 201 })
}
