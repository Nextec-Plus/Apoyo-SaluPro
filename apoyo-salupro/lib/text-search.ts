/* ───────────────────────────────────────────────────────────────────────────
 * Núcleo genérico de búsqueda de texto server-side sobre PostgREST.
 *
 * Resuelve, para cualquier tabla, los tres problemas del buscador ingenuo
 * (`ilike('columna', '%search%')`):
 *  1. Inyección/ruptura de PostgREST: cuando el término va a `.or(...)`, una
 *     coma o paréntesis ("García, María") rompe el filtro → 500. Se sanea.
 *  2. Nombre completo: "Juan Pérez" contra una columna nunca casa si el dato
 *     está partido en varias. Se tokeniza y cada palabra debe aparecer (AND).
 *  3. Acentos: "Perez" no encuentra "Pérez". Con una columna generada
 *     `search_index` (sin acentos, indexada con trigramas) la búsqueda es
 *     acento-insensible y rápida a escala.
 *
 * Estrategia con degradación elegante: si la columna índice existe (migración
 * aplicada) se usa la ruta rápida y acento-insensible; si no, se cae a una
 * búsqueda tokenizada y saneada sobre las columnas reales. Así el deploy del
 * código nunca rompe aunque la migración aún no se haya aplicado.
 *
 * Cada tabla obtiene su propia instancia vía `createTableTextSearch`, con su
 * propio caché por proceso de disponibilidad del índice.
 * ─────────────────────────────────────────────────────────────────────────── */

/* eslint-disable @typescript-eslint/no-explicit-any -- builder genérico de PostgREST */

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

export type TableTextSearch = {
  /** ¿Existe la columna índice acento-insensible para esta tabla? */
  hasSearchIndex: (supabase: any) => Promise<boolean>
  /** Aplica el filtro de búsqueda al query builder y lo devuelve. */
  applySearch: (query: any, raw: string, useIndex: boolean) => any
}

/**
 * Crea un buscador de texto para una tabla concreta.
 *
 * @param table         nombre de la tabla
 * @param indexColumn   columna generada acento-insensible (default: search_index)
 * @param legacyColumns columnas reales sobre las que hacer OR sin el índice
 */
export function createTableTextSearch(config: {
  table: string
  indexColumn?: string
  legacyColumns: string[]
}): TableTextSearch {
  const indexColumn = config.indexColumn ?? "search_index"

  /** Caché por proceso: ¿existe la columna generada índice? */
  let indexAvailable: boolean | null = null

  /**
   * Detecta una sola vez por proceso si la columna índice está presente. Sólo
   * cachea respuestas definitivas; ante un error transitorio devuelve `false`
   * (ruta segura) sin fijar el flag, para reintentar en la siguiente petición.
   */
  async function hasSearchIndex(supabase: any): Promise<boolean> {
    if (indexAvailable !== null) return indexAvailable
    const { error } = await supabase
      .from(config.table)
      .select(indexColumn)
      .limit(1)

    if (!error) {
      indexAvailable = true
      return true
    }
    // 42703 = undefined_column → la migración aún no se aplicó.
    if (error.code === "42703") {
      indexAvailable = false
      return false
    }
    return false // error transitorio: no cachear, usar ruta legacy esta vez
  }

  function applySearch(query: any, raw: string, useIndex: boolean): any {
    const tokens = tokenizeSearch(raw)
    if (tokens.length === 0) return query

    if (useIndex) {
      // Cada `.ilike` es un parámetro independiente (sin riesgo de inyección) y
      // se combinan con AND: todas las palabras deben aparecer en el índice.
      for (const token of tokens) {
        const term = normalizeTerm(token)
        if (term) query = query.ilike(indexColumn, `%${term}%`)
      }
      return query
    }

    // Ruta legacy (sin migración): OR por columna, AND entre palabras.
    for (const token of tokens) {
      const safe = sanitizeForOr(token)
      if (!safe) continue
      query = query.or(
        config.legacyColumns.map((c) => `${c}.ilike.%${safe}%`).join(","),
      )
    }
    return query
  }

  return { hasSearchIndex, applySearch }
}
