import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/config'
import type {
  InsertMissingPerson,
  MissingPersonStatus,
} from '@/lib/types/database'

/**
 * GET /api/missing-persons
 *
 * Cursor-paginated list. Backwards compatible:
 *  - Si NO se envía `limit`, se comporta como antes (devuelve TODO en `data`).
 *  - Si se envía `limit`, usa cursor pagination y devuelve:
 *      { items, next_cursor, has_more, error: null }
 *
 * Parámetros de búsqueda (todos server-side):
 *  - search    : texto libre (nombre/apellido/cedula ilike)
 *  - cedula    : cédula exacta
 *  - estado    : estado exacto
 *  - organization_id
 *  - limit     : tamaño de página (1..60)
 *  - cursor    : created_at,id del último item de la página anterior
 *
 * Optimización clave para 2000+ usuarios concurrentes:
 *  - Solo se traen `limit` filas por página (no TODO).
 *  - Solo 1 imagen por persona (no todas las imágenes).
 *  - Orden estable: created_at DESC, id DESC.
 *  - Cursor compuesto (created_at,id) → sin saltos ni duplicados en empates.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServiceClient()
  const { searchParams } = request.nextUrl

  const organization_id = searchParams.get('organization_id')
  const estado = searchParams.get('estado') as MissingPersonStatus | null
  const search = searchParams.get('search')
  const cedula = searchParams.get('cedula')

  const limitParam = searchParams.get('limit')
  const cursor = searchParams.get('cursor')
  const pageParam = searchParams.get('page')

  // Columnas ligeras compartidas por los modos paginados (1 imagen por persona).
  const LIST_COLUMNS =
    'id, organization_id, nombre, apellido, cedula, edad_aproximada, genero, ultimo_lugar_visto, informacion_adicional, estado, motivo_fallecimiento, fallecimiento_confirmado, contacto_nombre, contacto_apellido, contacto_correo, contacto_telefono_nacional, contacto_telefono_internacional, created_at, updated_at, missing_person_images!missing_person_images_missing_person_id_fkey(storage_path)'

  // Aplica los filtros comunes (search/estado/cedula/organization) a un query.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder de PostgREST
  const applyFilters = (q: any): any => {
    let query = q
    if (organization_id) query = query.eq('organization_id', organization_id)
    if (estado) query = query.eq('estado', estado)
    if (cedula) query = query.eq('cedula', cedula)
    if (search) {
      query = query.or(
        `nombre.ilike.%${search}%,apellido.ilike.%${search}%,cedula.ilike.%${search}%`,
      )
    }
    return query
  }

  // ── Modo legacy (sin paginación) ─────────────────────────────────────────
  if (limitParam === null) {
    const query = applyFilters(
      supabase
        .from('missing_persons')
        .select('*, missing_person_images(*)')
        .order('created_at', { ascending: false }),
    )

    const { data, error } = await query
    if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
    return Response.json({ data, error: null })
  }

  const limit = Math.max(1, Math.min(60, Number(limitParam) || 12))

  // ── Modo paginación por página (offset + count exacto) ───────────────────
  // Lo usa la landing para paginación numerada (1, 2, 3 … N). Devuelve total
  // para poder calcular el número de páginas en el cliente.
  if (pageParam !== null) {
    const page = Math.max(1, Number(pageParam) || 1)
    const from = (page - 1) * limit
    const to = from + limit - 1

    const query = applyFilters(
      supabase
        .from('missing_persons')
        .select(LIST_COLUMNS, { count: 'exact' })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to),
    )

    const { data, count, error } = await query
    if (error) {
      return Response.json({ items: null, error: error.message }, { status: 500 })
    }

    const total = count ?? 0
    const total_pages = Math.max(1, Math.ceil(total / limit))
    const res = Response.json({
      items: data ?? [],
      page,
      page_size: limit,
      total,
      total_pages,
      has_more: page < total_pages,
      error: null,
    })
    res.headers.set('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30')
    return res
  }

  // ── Modo cursor pagination (infinite scroll) ─────────────────────────────
  let query = applyFilters(
    supabase
      .from('missing_persons')
      .select(LIST_COLUMNS)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit),
  )

  // Cursor compuesto: created_at,id (formato: ISO,cadena-id).
  if (cursor) {
    const sep = cursor.lastIndexOf(',')
    if (sep > 0) {
      const cursorDate = cursor.slice(0, sep)
      const cursorId = cursor.slice(sep + 1)
      // (created_at < cursorDate) OR (created_at = cursorDate AND id < cursorId)
      query = query.or(
        `created_at.lt.${cursorDate},and(created_at.eq.${cursorDate},id.lt.${cursorId})`,
      )
    }
  }

  const { data, error } = await query
  if (error) {
    return Response.json({ items: null, error: error.message }, { status: 500 })
  }

  const items = (data ?? []) as Array<{
    id: string
    created_at: string
    [k: string]: unknown
  } & { missing_person_images?: Array<{ storage_path: string }> }>

  const last = items[items.length - 1]
  const next_cursor =
    items.length === limit && last
      ? `${last.created_at},${last.id}`
      : null

  // Cache pública breve en CDN/edge para absorber picos de 2000 usuarios.
  const res = Response.json({
    items,
    next_cursor,
    has_more: next_cursor !== null,
    error: null,
  })
  res.headers.set('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30')
  return res
}

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  let body: InsertMissingPerson
  try {
    body = await request.json()
  } catch (err) {
    return Response.json(
      { data: null, error: `JSON inválido: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    )
  }

  // Asociar a la organización por defecto si no viene en el body (reporte público).
  if (!body.organization_id) {
    body.organization_id = getOrganizationId()
  }

  const nombre = body.nombre?.trim()
  const apellido = body.apellido?.trim()

  if (!nombre) {
    return Response.json({ data: null, error: 'nombre es requerido' }, { status: 400 })
  }
  if (!apellido) {
    return Response.json({ data: null, error: 'apellido es requerido' }, { status: 400 })
  }

  // Los datos de contacto son opcionales. Las columnas contacto_nombre/apellido son
  // NOT NULL en la base de datos, así que normalizamos los ausentes a cadena vacía.
  // `fallecimiento_confirmado` lo controla el servidor (no se confía en el cliente):
  // solo se marca TRUE cuando se confirma una desaparición previa más abajo.
  const cedula = body.cedula?.trim() || null
  const insert: InsertMissingPerson = {
    ...body,
    nombre,
    apellido,
    cedula,
    contacto_nombre: body.contacto_nombre?.trim() || '',
    contacto_apellido: body.contacto_apellido?.trim() || '',
    fallecimiento_confirmado: false,
  }

  // ── Confirmación de fallecimiento sobre una desaparición previa ───────────
  // Si se registra una persona como fallecida (estado 'Confirmado Fallecido') y
  // su cédula ya estaba reportada como Desaparecida/Avistada, NO se duplica:
  // se actualiza ese registro a fallecido y se avisa al cliente con
  // `matched_missing` para que muestre la alerta correspondiente.
  if (insert.estado === 'Confirmado Fallecido' && cedula) {
    const { data: existing, error: lookupError } = await supabase
      .from('missing_persons')
      .select('id, nombre, apellido')
      .eq('cedula', cedula)
      .in('estado', ['Desaparecido', 'Avistado'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lookupError) {
      return Response.json({ data: null, error: lookupError.message }, { status: 500 })
    }

    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from('missing_persons')
        .update({
          estado: 'Confirmado Fallecido',
          motivo_fallecimiento: insert.motivo_fallecimiento ?? null,
          informacion_adicional: insert.informacion_adicional ?? undefined,
          fallecimiento_confirmado: true,
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (updateError) {
        return Response.json({ data: null, error: updateError.message }, { status: 500 })
      }

      return Response.json(
        {
          data: updated,
          matched_missing: {
            id: existing.id,
            nombre: existing.nombre,
            apellido: existing.apellido,
          },
          error: null,
        },
        { status: 200 },
      )
    }
  }

  const { data, error } = await supabase
    .from('missing_persons')
    .insert(insert)
    .select()
    .single()

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, matched_missing: null, error: null }, { status: 201 })
}