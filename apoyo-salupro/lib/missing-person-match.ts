import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, MissingPersonMatchType } from '@/lib/types/database'
import { isReferidoHospitalNotas, parseDestino, REFERIDO_HOSPITAL } from '@/lib/catastrophe-destinos'

type ServiceClient = SupabaseClient<Database>

export type FoundMatchResult = {
  missing_person_id: string
  missing_person_nombre: string
  missing_person_apellido: string
  match_type: MissingPersonMatchType
  created: boolean
}

/** Normaliza cédula venezolana para comparación (sin prefijo V/E, espacios ni guiones). */
export function normalizeCedula(cedula: string | null | undefined): string | null {
  if (!cedula?.trim()) return null
  const digits = cedula.replace(/[\s.\-]/g, '').replace(/^[vVeE]/, '')
  return digits || null
}

/** Normaliza nombre para comparación exacta (minúsculas, sin acentos, espacios colapsados). */
export function normalizeName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export function missingPersonFullName(person: { nombre: string; apellido: string }): string {
  return `${person.nombre} ${person.apellido}`.trim()
}

/**
 * Busca personas desaparecidas activas cuya cédula o nombre coincide con la ficha médica.
 * Registra coincidencias en `missing_person_found` y marca el reporte como Encontrado.
 */
export async function syncMissingPersonMatches(
  supabase: ServiceClient,
  victim: {
    id: string
    nombre_completo: string
    cedula: string | null
    ubicacion_actual_refugio?: string | null
    notas?: string | null
  },
): Promise<FoundMatchResult[]> {
  const normCedula = normalizeCedula(victim.cedula)
  const normName = normalizeName(victim.nombre_completo)

  if (!normCedula && !normName) return []

  const { data: candidates, error } = await supabase
    .from('missing_persons')
    .select('id, nombre, apellido, cedula, estado')
    .in('estado', ['Desaparecido', 'Avistado'])

  if (error || !candidates?.length) return []

  const results: FoundMatchResult[] = []

  for (const person of candidates) {
    let matchType: MissingPersonMatchType | null = null

    if (normCedula) {
      const personCedula = normalizeCedula(person.cedula)
      if (personCedula && personCedula === normCedula) {
        matchType = 'cedula'
      }
    }

    if (!matchType && normName) {
      const personName = normalizeName(missingPersonFullName(person))
      if (personName && personName === normName) {
        matchType = 'nombre'
      }
    }

    if (!matchType) continue

    const { error: insertError } = await supabase.from('missing_person_found').insert({
      missing_person_id: person.id,
      catastrophe_victim_id: victim.id,
      match_type: matchType,
    })

    const isDuplicate = insertError?.code === '23505'
    if (insertError && !isDuplicate) continue

    const created = !insertError

    if (person.estado !== 'Encontrado') {
      const update: { estado: 'Encontrado'; ultimo_lugar_visto?: string } = {
        estado: 'Encontrado',
      }
      if (isReferidoHospitalNotas(victim.notas)) {
        const { hospital } = parseDestino(victim.notas)
        update.ultimo_lugar_visto = hospital
          ? `${REFERIDO_HOSPITAL} — ${hospital}`
          : REFERIDO_HOSPITAL
      } else if (victim.ubicacion_actual_refugio?.trim()) {
        update.ultimo_lugar_visto = victim.ubicacion_actual_refugio.trim()
      }
      await supabase.from('missing_persons').update(update).eq('id', person.id)
    }

    results.push({
      missing_person_id: person.id,
      missing_person_nombre: person.nombre,
      missing_person_apellido: person.apellido,
      match_type: matchType,
      created,
    })
  }

  return results
}
