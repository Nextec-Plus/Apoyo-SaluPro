import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { CareState, InsertCatastropheVictim, TriageCategory } from '@/lib/types/database'
import { syncMissingPersonMatches } from '@/lib/missing-person-match'
import {
  applyVictimSearch,
  hasVictimSearchIndex,
} from '@/lib/catastrophe-victims-search'
import {
  DESTINOS,
  OBSERVACION_MODULO_MOVIL,
  REFERIDO_HOSPITAL,
} from '@/lib/catastrophe-destinos'

/**
 * Tope de filas del modo legacy (GET sin `limit`). El modo legacy es interno y
 * está deprecado: devolvía la tabla entera, lo que a escala (miles de filas) es
 * una bomba de memoria/latencia. Los consumidores reales usan paginación o el
 * cliente Supabase directo; este tope acota cualquier llamada legacy residual.
 */
const LEGACY_MAX_ROWS = 1000

/**
 * GET /api/catastrophe/victims
 *
 * Cursor-paginated. Backwards compatible:
 *  - Si NO se envía `limit`, modo legacy (interno/deprecado): hasta
 *    LEGACY_MAX_ROWS filas en `data`, sin paginar.
 *  - Si se envía `limit`, devuelve { items, next_cursor, has_more, error }.
 *
 * Filtros server-side:
 *  - triage_level : Verde | Amarillo | Rojo (trae todos por defecto)
 *  - care_state   : estado_destino exacto
 *  - cedula       : exacta
 *  - search       : texto libre, tokenizado y acento-insensible (search_index)
 *  - limit / cursor (compuesto: created_at,id) → cursor pagination.
 *
 * Optimización para lista virtualizada de pacientes: solo se traen `limit`
 * filas por página, orden estable created_at DESC, id DESC, sin saltos.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServiceClient()
  const { searchParams } = request.nextUrl

  const organization_id = searchParams.get('organization_id')
  const cedula = searchParams.get('cedula')
  const search = searchParams.get('search')
  const triage_level = searchParams.get('triage_level')
  const care_state = searchParams.get('care_state')
  const destino = searchParams.get('destino')
  const genero = searchParams.get('genero')
  const edadMin = searchParams.get('edad_min')
  const edadMax = searchParams.get('edad_max')

  const limitParam = searchParams.get('limit')
  const cursor = searchParams.get('cursor')

  if (!organization_id) {
    return Response.json({ data: null, error: 'organization_id es requerido' }, { status: 400 })
  }

  // ¿Está disponible la columna acento-insensible `search_index` (migración 007)?
  const useIndex = search ? await hasVictimSearchIndex(supabase) : false

  // ── Modo legacy (DEPRECADO / interno) ────────────────────────────────────
  // No pagina; topado a LEGACY_MAX_ROWS para no devolver la tabla entera.
  if (limitParam === null) {
    let query = supabase
      .from('catastrophe_victims')
      .select('*, catastrophe_victim_info(*)')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false })
      .limit(LEGACY_MAX_ROWS)

    if (cedula) query = query.eq('cedula', cedula)
    if (search) query = applyVictimSearch(query, search, useIndex)

    const { data, error } = await query
    if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
    return Response.json({ data, error: null })
  }

  // ── Modo cursor pagination ──────────────────────────────────────────────
  const limit = Math.max(1, Math.min(60, Number(limitParam) || 25))

  const validTriage = new Set<string>(["Rojo", "Amarillo", "Verde"])
  const validCareState = new Set<string>(["Triaje", "En Atención", "Hospitalizado", "Transferido", "Alta Médica", "Anulado"])
  const filterTriage = triage_level && validTriage.has(triage_level)
  const filterCareState = care_state && validCareState.has(care_state)

  // !inner join cuando filtramos sobre victim_info → PostgREST descarta filas
  // padre que no tienen info con los valores pedidos (LEFT JOIN no lo hace).
  const infoJoin = (filterTriage || filterCareState)
    ? 'catastrophe_victim_info!inner(triage_category, estado_destino, motivo_principal_consulta)'
    : 'catastrophe_victim_info!catastrophe_victim_info_victim_id_fkey(triage_category, estado_destino, motivo_principal_consulta)'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('catastrophe_victims')
    .select(
      `id, organization_id, nombre_completo, cedula, edad, genero, sector_comunidad, registration_number, notas, created_at, updated_at, ${infoJoin}`,
    )
    .eq('organization_id', organization_id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)

  if (cedula) query = query.ilike('cedula', `%${cedula.replace(/^[Vv]-?/, '')}%`)
  if (search) query = applyVictimSearch(query, search, useIndex)
  if (genero) query = query.eq('genero', genero)
  if (edadMin) query = query.gte('edad', Number(edadMin))
  if (edadMax) query = query.lte('edad', Number(edadMax))
  if (filterTriage) {
    query = query.eq('catastrophe_victim_info.triage_category', triage_level as TriageCategory)
  }
  if (filterCareState) {
    query = query.eq('catastrophe_victim_info.estado_destino', care_state as CareState)
  }
  if (destino && (DESTINOS as readonly string[]).includes(destino)) {
    if (destino === OBSERVACION_MODULO_MOVIL) {
      query = query.or(
        `notas.is.null,notas.eq.,notas.eq.${OBSERVACION_MODULO_MOVIL}`,
      )
    } else if (destino === REFERIDO_HOSPITAL) {
      query = query.ilike('notas', `${REFERIDO_HOSPITAL}%`)
    } else {
      query = query.eq('notas', destino)
    }
  }

  if (cursor) {
    const sep = cursor.lastIndexOf(',')
    if (sep > 0) {
      const cursorDate = cursor.slice(0, sep)
      const cursorId = cursor.slice(sep + 1)
      query = query.or(
        `created_at.lt.${cursorDate},and(created_at.eq.${cursorDate},id.lt.${cursorId})`,
      )
    }
  }

  const { data, error } = await query
  if (error) return Response.json({ items: null, error: error.message }, { status: 500 })

  const items = (data ?? []) as Array<{ id: string; created_at: string }>
  const last = items[items.length - 1]
  const next_cursor =
    items.length === limit && last ? `${last.created_at},${last.id}` : null

  const res = Response.json({
    items,
    next_cursor,
    has_more: next_cursor !== null,
    error: null,
  })
  res.headers.set('Cache-Control', 'private, s-maxage=10, stale-while-revalidate=20')
  return res
}

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  let body: InsertCatastropheVictim
  try {
    body = await request.json()
  } catch (err) {
    return Response.json(
      { data: null, error: `JSON inválido: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    )
  }

  if (!body.organization_id) {
    return Response.json({ data: null, error: 'organization_id es requerido' }, { status: 400 })
  }
  if (!body.nombre_completo) {
    return Response.json({ data: null, error: 'nombre_completo es requerido' }, { status: 400 })
  }

  // Nota: NO se valida cédula duplicada. Un mismo paciente puede recibir
  // atención varias veces (p. ej. vuelve al día siguiente), por lo que cada
  // ingreso genera un nuevo registro de atención aunque la cédula se repita.

  // Auto-generate registration_number: V-001, V-002, ...
  // Uses the latest registration_number (not COUNT) to avoid collisions when
  // records have been deleted or inserted out of sequence (e.g. bulk uploads).
  const { data: maxRow } = await supabase
    .from('catastrophe_victims')
    .select('registration_number')
    .eq('organization_id', body.organization_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastNum = maxRow?.registration_number
    ? parseInt(maxRow.registration_number.replace(/\D/g, ''), 10) || 0
    : 0

  // Retry up to 20 times in case of concurrent inserts grabbing the same number
  let data = null
  let insertErrMsg: string | null = null
  for (let attempt = 1; attempt <= 20; attempt++) {
    const registration_number = `V-${String(lastNum + attempt).padStart(3, '0')}`
    const result = await supabase
      .from('catastrophe_victims')
      .insert({ ...body, registration_number })
      .select()
      .single()

    if (!result.error) { data = result.data; break }
    if (result.error.code === '23505' && result.error.message.includes('registration_number')) continue
    insertErrMsg = result.error.message
    break
  }

  if (!data) {
    return Response.json(
      { data: null, error: insertErrMsg ?? 'No se encontró registration_number disponible' },
      { status: 500 },
    )
  }

  const found_matches = await syncMissingPersonMatches(supabase, {
    id: data.id,
    nombre_completo: data.nombre_completo,
    cedula: data.cedula,
    ubicacion_actual_refugio: data.ubicacion_actual_refugio,
    notas: data.notas,
  })

  return Response.json({ data, found_matches, error: null }, { status: 201 })
}
