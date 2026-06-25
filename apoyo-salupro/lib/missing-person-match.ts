import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, MissingPersonMatchType } from '@/lib/types/database'

type ServiceClient = SupabaseClient<Database>

export type FoundMatchResult = {
  missing_person_id: string
  missing_person_nombre: string
  missing_person_apellido: string
  match_type: MissingPersonMatchType
  created: boolean
}

/**
 * Normaliza cédula venezolana para comparación.
 * Acepta equivalentes: v-100000, V-10000, 10.000.000, 10000, V 10.000.000, E-12345678.
 * Resultado: solo dígitos, sin ceros a la izquierda.
 */
export function normalizeCedula(cedula: string | null | undefined): string | null {
  if (!cedula?.trim()) return null
  const digits = cedula.replace(/\D/g, '')
  if (!digits) return null
  return digits.replace(/^0+/, '') || '0'
}

/**
 * Normaliza nombre para comparación exacta.
 * Ignora mayúsculas/minúsculas, acentos, puntuación y espacios extra.
 */
export function normalizeName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[.,'"()-]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function missingPersonFullName(person: { nombre: string; apellido: string }): string {
  return `${person.nombre} ${person.apellido}`.trim()
}

/** Palabras normalizadas de un nombre (sin vacíos). */
export function nameToWords(name: string | null | undefined): string[] {
  const norm = normalizeName(name)
  if (!norm) return []
  return norm.split(' ').filter(Boolean)
}

/** Mismo conjunto de palabras, sin importar el orden ni repeticiones. */
export function wordsSameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length || a.length === 0) return false
  const count = (words: string[]) => {
    const map = new Map<string, number>()
    for (const w of words) map.set(w, (map.get(w) ?? 0) + 1)
    return map
  }
  const left = count(a)
  const right = count(b)
  if (left.size !== right.size) return false
  for (const [word, n] of left) {
    if (right.get(word) !== n) return false
  }
  return true
}

/**
 * Coincidencia flexible de nombres:
 * 1. Mismas palabras en cualquier orden (ej. "Pérez Juan" ↔ "Juan Pérez")
 * 2. Primer nombre + primer apellido presentes en la ficha (ej. "González María" ↔ nombre María, apellido González)
 */
export function namesMatchFlexible(
  victimFullName: string,
  nombre: string,
  apellido: string,
): boolean {
  const victimWords = nameToWords(victimFullName)
  if (victimWords.length === 0) return false

  const victimSet = new Set(victimWords)
  const personWords = nameToWords(missingPersonFullName({ nombre, apellido }))
  if (personWords.length === 0) return false

  if (wordsSameSet(victimWords, personWords)) return true

  const primerNombre = nameToWords(nombre)[0]
  const primerApellido = nameToWords(apellido)[0]
  if (primerNombre && primerApellido) {
    return victimSet.has(primerNombre) && victimSet.has(primerApellido)
  }

  return false
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
      if (namesMatchFlexible(victim.nombre_completo, person.nombre, person.apellido)) {
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
      if (victim.ubicacion_actual_refugio?.trim()) {
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
