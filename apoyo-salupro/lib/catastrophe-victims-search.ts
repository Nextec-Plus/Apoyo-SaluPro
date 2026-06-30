/* ───────────────────────────────────────────────────────────────────────────
 * Búsqueda de pacientes (víctimas de catástrofe).
 *
 * Instancia del núcleo genérico `createTableTextSearch` (ver lib/text-search.ts)
 * para la tabla `catastrophe_victims`. Antes el endpoint hacía
 * `ilike('nombre_completo', '%search%')`: sin tokenizar ni acentos. Ahora
 * tokeniza, y con la migración 007 usa la columna acento-insensible
 * `search_index` (nombre_completo + cédula).
 * ─────────────────────────────────────────────────────────────────────────── */

import { createTableTextSearch } from "@/lib/text-search"

const search = createTableTextSearch({
  table: "catastrophe_victims",
  indexColumn: "search_index",
  legacyColumns: ["nombre_completo", "cedula"],
})

export const hasVictimSearchIndex = search.hasSearchIndex
export const applyVictimSearch = search.applySearch
