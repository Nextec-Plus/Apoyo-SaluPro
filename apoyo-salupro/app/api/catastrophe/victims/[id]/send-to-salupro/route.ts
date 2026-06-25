import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseDestino } from '@/lib/catastrophe-destinos'

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<'/api/catastrophe/victims/[id]/send-to-salupro'>,
) {
  const { id } = await ctx.params
  const apiKey = process.env.SALUPRO_API_KEY
  if (!apiKey) {
    return Response.json({ data: null, error: 'SALUPRO_API_KEY no configurada' }, { status: 500 })
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
  const diagnostico = info?.motivo_principal_consulta?.trim() || 'Sin diagnóstico'

  const { destino, hospital } = parseDestino(victim.notas)
  const referido_a = hospital.trim() || destino.trim() || undefined

  const form = new FormData()
  form.append('cedula', victim.cedula)
  form.append('diagnostico', diagnostico)
  form.append('correo_1', 'apoyo@salupro.dummy')
  form.append('telefono_1', '04120000000')
  form.append('tipo_consulta', 'CONSULTA')
  if (referido_a) form.append('referido_a', referido_a)

  let saluRes: Response
  try {
    saluRes = await fetch('https://api.salu.pro/v1/data/receive', {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: form,
    })
  } catch (err) {
    return Response.json(
      { data: null, error: `Error de conexión con SaluPro: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    )
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

  return Response.json({ data, error: null }, { status: 201 })
}
