import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseDestino } from '@/lib/catastrophe-destinos'

const ACTIVE_STATES = new Set(['Triaje', 'En Atención', 'Hospitalizado'])

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const monitorKey = process.env.MONITOR_API_KEY

  if (!monitorKey || apiKey !== monitorKey) {
    return Response.json({ data: null, error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '40'), 100)
  const organization_id = searchParams.get('organization_id')

  const supabase = await createServiceClient()

  // Consulta principal: solo víctimas actualmente en atención (excluye Referido y Egreso)
  let query = supabase
    .from('catastrophe_victims')
    .select(`
      id,
      registration_number,
      nombre_completo,
      cedula,
      edad,
      genero,
      sector_comunidad,
      ubicacion_actual_refugio,
      notas,
      catastrophe_victim_info!inner (
        triage_category,
        estado_destino,
        motivo_principal_consulta,
        fecha_hora_entrada
      )
    `)
    .in('catastrophe_victim_info.estado_destino', Array.from(ACTIVE_STATES))
    .order('created_at', { ascending: false })
    .limit(limit)

  if (organization_id) query = query.eq('organization_id', organization_id)

  // Totales para el resumen
  let countQuery = supabase
    .from('catastrophe_victims')
    .select('id, notas, catastrophe_victim_info(estado_destino, triage_category)', { count: 'exact' })

  let missingQuery = supabase
    .from('missing_persons')
    .select('id', { count: 'exact', head: true })
    .not('status', 'in', '("Encontrado","Fallecido")')

  if (organization_id) {
    countQuery = countQuery.eq('organization_id', organization_id)
    missingQuery = missingQuery.eq('organization_id', organization_id)
  }

  const [{ data: victims, error }, { data: allVictims, count: totalVictimas }, { count: totalDesaparecidos }] =
    await Promise.all([query, countQuery, missingQuery])

  if (error) {
    return Response.json({ data: null, error: error.message }, { status: 500 })
  }

  // Calcular resumen a partir del listado completo
  let casosActivos = 0
  let referidosHospital = 0
  const triaje: Record<string, number> = {}
  const estados: Record<string, number> = {}

  for (const v of allVictims ?? []) {
    const infoRaw = v.catastrophe_victim_info
    const info = Array.isArray(infoRaw) ? infoRaw[0] : infoRaw
    const estadoDestino = info?.estado_destino as string | undefined
    const triageCategory = info?.triage_category as string | undefined

    if (estadoDestino) {
      estados[estadoDestino] = (estados[estadoDestino] ?? 0) + 1
      if (ACTIVE_STATES.has(estadoDestino)) casosActivos++
    }
    if (triageCategory) {
      triaje[triageCategory] = (triaje[triageCategory] ?? 0) + 1
    }
    const { hospital } = parseDestino((v as { notas?: string | null }).notas)
    if (hospital) referidosHospital++
  }

  // Mapear casos recientes al shape esperado por el monitor
  const casos_recientes = (victims ?? []).map((v) => {
    const infoRaw = v.catastrophe_victim_info
    const info = Array.isArray(infoRaw) ? infoRaw[0] : infoRaw
    const { destino, hospital } = parseDestino(v.notas)

    return {
      id: v.id,
      registro: v.registration_number ?? null,
      nombre_completo: v.nombre_completo ?? null,
      cedula: v.cedula ?? null,
      edad: v.edad ?? null,
      genero: v.genero ?? null,
      sector_comunidad: v.sector_comunidad ?? null,
      ubicacion_actual_refugio: v.ubicacion_actual_refugio ?? null,
      triage_category: (info?.triage_category ?? 'Verde') as 'Rojo' | 'Amarillo' | 'Verde',
      estado_destino: info?.estado_destino ?? 'Triaje',
      destino,
      hospital_referido: hospital || null,
      motivo_principal_consulta: info?.motivo_principal_consulta ?? null,
      fecha_hora_entrada: info?.fecha_hora_entrada ?? new Date().toISOString(),
    }
  })

  return Response.json({
    data: {
      generated_at: new Date().toISOString(),
      resumen: {
        total_victimas: totalVictimas ?? 0,
        casos_activos: casosActivos,
        referidos_hospital: referidosHospital,
        total_desaparecidos: totalDesaparecidos ?? 0,
        triaje,
        estados,
      },
      casos_recientes,
    },
    error: null,
  })
}
