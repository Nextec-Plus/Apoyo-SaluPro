import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseDestino } from '@/lib/catastrophe-destinos'

const SALUPRO_BASE = 'https://api.salu.pro/v1'

// Todos los sectores del módulo de catástrofe pertenecen al estado Vargas (La Guaira) — ID 22
const SECTOR_STATE_ID: Record<string, string> = {
  'Maiquetía':   '22',
  'Caraballeda': '22',
  'Macuto':      '22',
  'La Guaira':   '22',
  'Naiguatá':    '22',
  'Caruao':      '22',
  'Tanaguarena': '22',
  'Otro':        '22',
}
const DEFAULT_STATE_ID = '22' // Vargas

function resolveStateId(sector_comunidad: string | null | undefined): string {
  if (!sector_comunidad) return DEFAULT_STATE_ID
  return SECTOR_STATE_ID[sector_comunidad] ?? DEFAULT_STATE_ID
}

async function sendConsultation(
  apiKey: string,
  cedula: string,
  diagnostico: string,
  referido_a: string | undefined,
): Promise<Response> {
  const form = new FormData()
  form.append('cedula', cedula)
  form.append('diagnostico', diagnostico)
  form.append('correo_1', 'apoyo@salupro.dummy')
  form.append('telefono_1', '04120000000')
  form.append('tipo_consulta', 'CONSULTA')
  if (referido_a) form.append('referido_a', referido_a)

  return fetch(`${SALUPRO_BASE}/data/receive`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: form,
  })
}

async function registerAsTitular(
  apiKey: string,
  cedula: string,
  nombre: string,
  telefono: string | null | undefined,
  stateId: string,
  clientId: string,
): Promise<Response> {
  return fetch(`${SALUPRO_BASE}/titulares-de-seguros`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ci: cedula.replace(/\D/g, ''),
      name: nombre,
      phone: telefono?.trim() || '04120000000',
      state: stateId,
      clientId,
      createAsPatient: true,
    }),
  })
}

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<'/api/catastrophe/victims/[id]/send-to-salupro'>,
) {
  const { id } = await ctx.params

  const apiKey = process.env.SALUPRO_API_KEY
  const cgmClientId = process.env.SALUPRO_CGM_CLIENT_ID

  if (!apiKey) {
    return Response.json({ data: null, error: 'SALUPRO_API_KEY no configurada' }, { status: 500 })
  }
  if (!cgmClientId) {
    return Response.json({ data: null, error: 'SALUPRO_CGM_CLIENT_ID no configurada' }, { status: 500 })
  }

  const supabase = await createServiceClient()
  const { data: victim, error: victimError } = await supabase
    .from('catastrophe_victims')
    .select('*, catastrophe_victim_info(*)')
    .eq('id', id)
    .single()

  if (victimError || !victim) {
    const status = victimError?.code === 'PGRST116' ? 404 : 500
    return Response.json(
      { data: null, error: victimError?.message ?? 'Paciente no encontrado' },
      { status },
    )
  }

  if (!victim.cedula) {
    return Response.json(
      { data: null, error: 'El paciente no tiene cédula registrada' },
      { status: 422 },
    )
  }

  const infoRaw = victim.catastrophe_victim_info
  const info = Array.isArray(infoRaw) ? infoRaw[0] ?? null : infoRaw ?? null

  if (info?.salupro_sent_at) {
    return Response.json(
      { data: null, error: `Este paciente ya fue enviado a SaluPro el ${new Date(info.salupro_sent_at).toLocaleString('es-VE')}` },
      { status: 409 },
    )
  }

  const diagnostico = info?.motivo_principal_consulta?.trim() || 'Sin diagnóstico'

  const { destino, hospital } = parseDestino(victim.notas)
  const referido_a = hospital.trim() || destino.trim() || undefined

  // ── Paso 1: intentar enviar la consulta directamente ──
  let saluRes: Response
  try {
    saluRes = await sendConsultation(apiKey, victim.cedula, diagnostico, referido_a)
  } catch (err) {
    return Response.json(
      { data: null, error: `Error de conexión con SaluPro: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    )
  }

  // ── Paso 2: si la víctima no existe en SaluPro, registrarla como titular ──
  if (saluRes.status === 404) {
    if (!victim.nombre_completo) {
      return Response.json(
        { data: null, error: 'El paciente no tiene nombre completo registrado, necesario para crear el titular en SaluPro' },
        { status: 422 },
      )
    }

    const stateId = resolveStateId(victim.sector_comunidad)

    let titularRes: Response
    try {
      titularRes = await registerAsTitular(
        apiKey,
        victim.cedula,
        victim.nombre_completo,
        victim.telefono_contacto,
        stateId,
        cgmClientId,
      )
    } catch (err) {
      return Response.json(
        { data: null, error: `Error al registrar titular en SaluPro: ${err instanceof Error ? err.message : String(err)}` },
        { status: 502 },
      )
    }

    if (!titularRes.ok) {
      const errText = await titularRes.text()
      let errMsg: string
      try {
        const errJson = JSON.parse(errText) as Record<string, unknown>
        errMsg = String(errJson.message ?? errText)
      } catch {
        errMsg = errText
      }
      return Response.json(
        { data: null, error: `No se pudo registrar la víctima en SaluPro: ${errMsg}` },
        { status: titularRes.status },
      )
    }

    // Reintentar la consulta tras registrar el titular
    try {
      saluRes = await sendConsultation(apiKey, victim.cedula, diagnostico, referido_a)
    } catch (err) {
      return Response.json(
        { data: null, error: `Error de conexión con SaluPro (reintento): ${err instanceof Error ? err.message : String(err)}` },
        { status: 502 },
      )
    }
  }

  const text = await saluRes.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }

  if (!saluRes.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as Record<string, unknown>).message)
        : `SaluPro respondió con status ${saluRes.status}`
    return Response.json({ data: null, error: message }, { status: saluRes.status })
  }

  // Marcar como enviado para evitar reenvíos
  if (info?.id) {
    await supabase
      .from('catastrophe_victim_info')
      .update({ salupro_sent_at: new Date().toISOString() })
      .eq('id', info.id)
  }

  return Response.json({ data, error: null }, { status: 201 })
}
