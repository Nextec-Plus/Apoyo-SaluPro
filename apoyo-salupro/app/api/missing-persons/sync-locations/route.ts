import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isReferidoHospitalNotas, parseDestino, REFERIDO_HOSPITAL, DESTINOS } from '@/lib/catastrophe-destinos'

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()
  const { searchParams } = request.nextUrl
  const organization_id = searchParams.get('organization_id')

  // Fetch all found matches with victim location data
  let query = supabase
    .from('missing_person_found')
    .select(
      `
      missing_person_id,
      catastrophe_victims (
        id,
        organization_id,
        notas,
        ubicacion_actual_refugio
      )
    `,
    )

  const { data: matches, error } = await query

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!matches?.length) return Response.json({ updated: 0 })

  let updated = 0

  for (const match of matches) {
    const victim = match.catastrophe_victims as {
      id: string
      organization_id: string
      notas: string | null
      ubicacion_actual_refugio: string | null
    } | null

    if (!victim) continue
    if (organization_id && victim.organization_id !== organization_id) continue

    let newLocation: string | undefined
    if (victim.notas?.trim()) {
      if (isReferidoHospitalNotas(victim.notas)) {
        const { hospital } = parseDestino(victim.notas)
        newLocation = hospital ? `${REFERIDO_HOSPITAL} — ${hospital}` : REFERIDO_HOSPITAL
      } else {
        const { destino } = parseDestino(victim.notas)
        if ((DESTINOS as readonly string[]).includes(destino)) {
          newLocation = destino
        }
      }
    }
    if (!newLocation && victim.ubicacion_actual_refugio?.trim()) {
      newLocation = victim.ubicacion_actual_refugio.trim()
    }

    if (!newLocation) continue

    const { error: updateError } = await supabase
      .from('missing_persons')
      .update({ ultimo_lugar_visto: newLocation })
      .eq('id', match.missing_person_id)

    if (!updateError) updated++
  }

  return Response.json({ updated })
}
