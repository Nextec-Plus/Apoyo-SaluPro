/* ───────────────────────────────────────────────────────────────────────────
 * Núcleo de búsqueda server-side de personas desaparecidas.
 *
 * Resuelve tres problemas del buscador anterior:
 *  1. Inyección/ruptura de PostgREST: el término iba directo a `.or(...)`, así
 *     que una coma o paréntesis ("García, María") rompía el filtro → 500.
 *  2. Nombre completo: "Juan Pérez" hacía `nombre ilike %Juan Pérez%` y nunca
 *     casaba porque nombre="Juan" y apellido="Pérez". Ahora se tokeniza y cada
 *     palabra debe aparecer en nombre, apellido o cédula (AND entre palabras).
 *  3. Acentos: "Perez" no encontraba "Pérez". Con la migración 006 se compara
 *     contra una columna `search_index` sin acentos e indexada con trigramas.
 *
 * Estrategia con degradación elegante: si la columna `search_index` existe
 * (migración aplicada) se usa la ruta rápida y acento-insensible; si no, se cae
 * a una búsqueda tokenizada y saneada sobre las columnas reales. Así el deploy
 * del código nunca rompe aunque la migración aún no se haya aplicado.
 * ─────────────────────────────────────────────────────────────────────────── */

/* eslint-disable @typescript-eslint/no-explicit-any -- builder genérico de PostgREST */

/** Caché por proceso: ¿existe la columna generada `search_index`? */
let searchIndexAvailable: boolean | null = null

/** Número máximo de palabras consideradas (evita queries patológicas). */
const MAX_TOKENS = 6

/** Rango Unicode de marcas diacríticas combinantes (acentos). */
const DIACRITICS = /[̀-ͯ]/g

/** Quita acentos/diacríticos y normaliza a minúsculas. */
export function normalizeTerm(value: string): string {
  return value.normalize("NFD").replace(DIACRITICS, "").toLowerCase()
}

/** Divide el término libre en palabras significativas (máx. MAX_TOKENS). */
export function tokenizeSearch(raw: string): string[] {
  return raw.trim().split(/\s+/).filter(Boolean).slice(0, MAX_TOKENS)
}

/**
 * Sanea una palabra para incrustarla en la cadena de un `.or()` de PostgREST.
 * Elimina los caracteres que tienen significado en la gramática del filtro
 * (`,` separa condiciones, `()` agrupan) y los comodines de LIKE (`%`, `_`),
 * de modo que el valor se trate como texto literal.
 */
function sanitizeForOr(token: string): string {
  return token.replace(/[,()%_*\\]/g, " ").trim()
}

/**
 * Detecta una sola vez por proceso si la columna `search_index` está presente.
 * Sólo cachea respuestas definitivas; ante un error transitorio devuelve `false`
 * (ruta segura) sin fijar el flag, para reintentar en la siguiente petición.
 */
export async function hasSearchIndex(supabase: any): Promise<boolean> {
  if (searchIndexAvailable !== null) return searchIndexAvailable
  const { error } = await supabase
    .from("missing_persons")
    .select("search_index")
    .limit(1)

  if (!error) {
    searchIndexAvailable = true
    return true
  }
  // 42703 = undefined_column → la migración aún no se aplicó.
  if (error.code === "42703") {
    searchIndexAvailable = false
    return false
  }
  return false // error transitorio: no cachear, usar ruta legacy esta vez
}

/**
 * Aplica el filtro de búsqueda de texto al query builder.
 *
 * @param query     query builder de PostgREST (encadenable)
 * @param raw       término libre tal cual lo escribió el usuario
 * @param useIndex  true si `search_index` está disponible (acento-insensible)
 */
export function applyMissingPersonSearch(
  query: any,
  raw: string,
  useIndex: boolean,
): any {
  const tokens = tokenizeSearch(raw)
  if (tokens.length === 0) return query

  if (useIndex) {
    // Cada `.ilike` es un parámetro independiente (sin riesgo de inyección) y
    // se combinan con AND: todas las palabras deben aparecer en search_index.
    for (const token of tokens) {
      const term = normalizeTerm(token)
      if (term) query = query.ilike("search_index", `%${term}%`)
    }
    return query
  }

  // Ruta legacy (sin migración): OR por columna, AND entre palabras.
  for (const token of tokens) {
    const safe = sanitizeForOr(token)
    if (!safe) continue
    query = query.or(
      `nombre.ilike.%${safe}%,apellido.ilike.%${safe}%,cedula.ilike.%${safe}%`,
    )
  }
  return query
}
