import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/config'
import { parseDestino, REFERIDO_HOSPITAL } from '@/lib/catastrophe-destinos'
import type {
  CareState,
  TriageCategory,
  MissingPersonStatus,
} from '@/lib/types/database'

/**
 * Endpoint público de monitoreo para consumo externo (SaluPro / cgm.salu.pro).
 *
 * Expone, en vivo, un resumen agregado + los casos más recientes de la crisis
 * para alimentar un dashboard/monitor en otro sistema.
 *
 * Autenticación: cabecera compartida. SaluPro debe enviar:
 *
 *   x-api-key: salupro-monitor-3f9a1c7e5b2d4860a1f8e6c2
 *
 * (También se acepta `Authorization: Bearer <key>`.)
 *
 * El valor puede sobreescribirse con la variable de entorno MONITOR_API_KEY.
 *
 * Ejemplos:
 *   GET /api/monitor
 *   GET /api/monitor?organization_id=<uuid>&limit=30
 */

// ── Cabecera de acceso (hardcodeada; colócala tal cual en SaluPro) ────────────
const MONITOR_API_KEY =
  process.env.MONITOR_API_KEY ?? 'salupro-monitor-3f9a1c7e5b2d4860a1f8e6c2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Max-Age': '86400',
}

const CARE_STATES: CareState[] = [
  'Triaje',
  'En Atención',
  'Hospitalizado',
  'Transferido',
  'Alta Médica',
  'Anulado',
]
const TRIAGE_CATEGORIES: TriageCategory[] = ['Rojo', 'Amarillo', 'Verde']
const MISSING_STATES: MissingPersonStatus[] = [
  'Desaparecido',
  'Avistado',
  'Encontrado',
  'Confirmado Fallecido',
]

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS })
}

function isAuthorized(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  if (apiKey && apiKey === MONITOR_API_KEY) return true

  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ') && auth.slice(7) === MONITOR_API_KEY) return true

  return false
}

// Preflight CORS para que un navegador externo pueda llamar con cabecera custom.
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return json({ data: null, error: 'No autorizado: cabecera x-api-key inválida o ausente' }, 401)
  }

  const supabase = await createServiceClient()
  const { searchParams } = request.nextUrl

  // Por defecto la organización de la crisis; se puede sobreescribir por query.
  const organization_id = searchParams.get('organization_id') ?? getOrganizationId()
  const limitParam = Number(searchParams.get('limit'))
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50

  // ── Casos clínicos (triaje) + datos de la víctima ───────────────────────────
  const casosQuery = supabase
    .from('catastrophe_victim_info')
    .select('*, catastrophe_victims(*)')
    .eq('organization_id', organization_id)
    .order('fecha_hora_entrada', { ascending: false })

  // ── Personas desaparecidas ──────────────────────────────────────────────────
  // Los reportes públicos no siempre llevan organization_id, por eso solo se
  // filtra cuando el consumidor lo pide explícitamente por query string.
  let desaparecidosQuery = supabase
    .from('missing_persons')
    .select('id, nombre, apellido, estado, ultimo_lugar_visto, created_at')
    .order('created_at', { ascending: false })

  const orgFilter = searchParams.get('organization_id')
  if (orgFilter) desaparecidosQuery = desaparecidosQuery.eq('organization_id', orgFilter)

  const [casosRes, desaparecidosRes] = await Promise.all([casosQuery, desaparecidosQuery])

  if (casosRes.error) return json({ data: null, error: casosRes.error.message }, 500)
  if (desaparecidosRes.error) return json({ data: null, error: desaparecidosRes.error.message }, 500)

  const casos = casosRes.data ?? []
  const desaparecidos = desaparecidosRes.data ?? []

  // ── Agregados para el monitor ───────────────────────────────────────────────
  const triaje = Object.fromEntries(TRIAGE_CATEGORIES.map((c) => [c, 0])) as Record<
    TriageCategory,
    number
  >
  const estados = Object.fromEntries(CARE_STATES.map((s) => [s, 0])) as Record<CareState, number>
  for (const c of casos) {
    if (c.triage_category in triaje) triaje[c.triage_category] += 1
    if (c.estado_destino in estados) estados[c.estado_destino] += 1
  }

  const desaparecidosPorEstado = Object.fromEntries(
    MISSING_STATES.map((s) => [s, 0]),
  ) as Record<MissingPersonStatus, number>
  for (const d of desaparecidos) {
    if (d.estado in desaparecidosPorEstado) desaparecidosPorEstado[d.estado] += 1
  }

  // Casos activos = aún no dados de alta / anulados.
  const casosActivos = casos.filter(
    (c) => c.estado_destino !== 'Alta Médica' && c.estado_destino !== 'Anulado',
  ).length

  // Referidos al hospital: el destino se guarda en victims.notas (formato propio).
  let referidosHospital = 0
  for (const c of casos) {
    const v = c.catastrophe_victims as { notas?: string | null } | null
    if (parseDestino(v?.notas).destino === REFERIDO_HOSPITAL) referidosHospital += 1
  }

  // ── Casos recientes (lista compacta para tabla en vivo) ─────────────────────
  const casosRecientes = casos.slice(0, limit).map((c) => {
    const v = c.catastrophe_victims as { [k: string]: unknown } | null
    const { destino, hospital } = parseDestino(v?.notas as string | null | undefined)
    return {
      id: c.id,
      registro: v?.registration_number ?? null,
      nombre_completo: v?.nombre_completo ?? null,
      cedula: v?.cedula ?? null,
      edad: v?.edad ?? null,
      genero: v?.genero ?? null,
      sector_comunidad: v?.sector_comunidad ?? null,
      ubicacion_actual_refugio: v?.ubicacion_actual_refugio ?? null,
      triage_category: c.triage_category,
      estado_destino: c.estado_destino,
      destino,
      hospital_referido: hospital || null,
      motivo_principal_consulta: c.motivo_principal_consulta,
      fecha_hora_entrada: c.fecha_hora_entrada,
    }
  })

  return json({
    data: {
      generated_at: new Date().toISOString(),
      crisis: {
        evento: 'TERREMOTO LA GUAIRA',
        fecha: '2026-06-25',
        ubicacion: 'La Guaira, Venezuela',
      },
      resumen: {
        total_victimas: casos.length,
        casos_activos: casosActivos,
        referidos_hospital: referidosHospital,
        total_desaparecidos: desaparecidos.length,
        triaje,
        estados,
        desaparecidos_por_estado: desaparecidosPorEstado,
      },
      casos_recientes: casosRecientes,
    },
    error: null,
  })
}
