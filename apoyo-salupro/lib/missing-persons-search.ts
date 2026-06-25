/* ───────────────────────────────────────────────────────────────────────────
 * Búsqueda de personas desaparecidas.
 *
 * Instancia del núcleo genérico `createTableTextSearch` (ver lib/text-search.ts)
 * para la tabla `missing_persons`. El nombre vive partido en `nombre`/`apellido`
 * (+ `cedula`), por lo que la búsqueda tokeniza y exige que cada palabra aparezca
 * en alguna de esas columnas; con la migración 006 usa la columna acento-
 * insensible `search_index`.
 * ─────────────────────────────────────────────────────────────────────────── */

import {
  createTableTextSearch,
  normalizeTerm,
  tokenizeSearch,
} from "@/lib/text-search"

const search = createTableTextSearch({
  table: "missing_persons",
  indexColumn: "search_index",
  legacyColumns: ["nombre", "apellido", "cedula"],
})

export const hasSearchIndex = search.hasSearchIndex
export const applyMissingPersonSearch = search.applySearch

export { normalizeTerm, tokenizeSearch }
