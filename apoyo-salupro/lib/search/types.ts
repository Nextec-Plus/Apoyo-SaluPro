import type {
  CatastropheVictim,
  CatastropheVictimInfo,
} from "@/lib/types/database"

/* ───────────────────────────────────────────────────────────────────────────
 * Search Core — sistema de búsqueda reutilizable, configurable por contexto.
 *
 * Principio: UN solo motor de búsqueda (fetch + cursor pagination + chips +
 * infinite/virtualized), configurado por `SearchConfig`.
 * Diferentes módulos (Personas desaparecidas / Pacientes / …) solo cambian
 * la configuración: filtros disponibles, vista (grid|list), endpoint, parseo.
 * ─────────────────────────────────────────────────────────────────────── */

export type EntityId = "missing_persons" | "patients"

export type ViewMode = "grid" | "list"

/** Estrategia de paginación: scroll infinito (cursor) o páginas numeradas. */
export type PaginationMode = "infinite" | "pages"

/** Definición de un filtro individual (dinámico por contexto). */
export type FilterDef<TFilters extends Record<string, unknown>> = {
  /** Clave en el objeto de filtros activos. */
  key: keyof TFilters & string
  /** Etiqueta humana. */
  label: string
  /** Tipo de control a renderizar. */
  type: "select" | "text"
  /** Para type=select: lista de opciones. */
  options?: readonly { value: string; label: string }[]
  /** Valor `todos` (sin filtro) — se omite del query al backend. */
  allValue?: string
  /** Placeholder para type=text. */
  placeholder?: string
}

/** Estado interno del motor de búsqueda. */
export type SearchState<TItem, TFilters extends Record<string, unknown>> = {
  /** Término de búsqueda libre (debounced). */
  search: string
  /** Resultados acumulados (append en infinite scroll). */
  items: TItem[]
  /** Cursor compuesto (created_at,id) para traer la siguiente página, o null. */
  nextCursor: string | null
  /** true si quedan más páginas en servidor. */
  hasMore: boolean
  loading: boolean
  /** true mientras carga la PRIMERA página (muestra skeletons). */
  loadingInitial: boolean
  error: string | null
  /** Filtros activos por clave. */
  filters: TFilters
  /** Modo "pages": página actual (1-based). En "infinite" se mantiene en 1. */
  page: number
  /** Modo "pages": total de resultados (del count exacto del backend). */
  total: number
  /** Modo "pages": número total de páginas. */
  totalPages: number
}

/** Respuesta normalizada del backend. */
export type SearchResponse<TItem> = {
  items: TItem[]
  next_cursor: string | null
  has_more: boolean
  error: string | null
  /** Modo "pages": total de resultados (count exacto). */
  total?: number
  /** Modo "pages": número total de páginas. */
  total_pages?: number
}

/** Configuración de un contexto de búsqueda. */
export type SearchConfig<TItem, TFilters extends Record<string, unknown>> = {
  /** Identificador del contexto (para depuración / telemetría). */
  entity: EntityId
  /** Endpoint del API (cursor-paginated). */
  endpoint: string
  /** Tamaño de página. */
  pageSize: number
  /** Filtros disponibles para este contexto. */
  filters: FilterDef<TFilters>[]
  /** Modo de render de resultados. */
  view: ViewMode
  /** Estrategia de paginación. Por defecto "infinite" (cursor + scroll). */
  paginationMode?: PaginationMode
  /** Valores iniciales de los filtros. */
  initialFilters: TFilters
  /**
   * Construye el querystring a partir de search + filtros + cursor/página.
   * Devuelve el path completo `/endpoint?...`.
   * En modo "infinite" llega `cursor`; en modo "pages" llega `page`.
   */
  buildQuery: (input: {
    search: string
    filters: TFilters
    cursor: string | null
    page: number | null
    pageSize: number
  }) => string
  /** Parsea la respuesta del backend → { items, next_cursor, has_more }. */
  parseResponse: (json: unknown) => SearchResponse<TItem>
  /** ms de debounce para el input de búsqueda. */
  searchDebounceMs?: number
}

/* ── Tipos de items específicos por contexto ────────────────────────────── */

/** Imagen reducida que devuelve el cursor pagination de missing_persons. */
export type MissingPersonSearchImage = { storage_path: string }

/** Item de búsqueda de personas desaparecidas (forma paginada). */
export type MissingPersonSearchItem = {
  id: string
  organization_id: string | null
  nombre: string
  apellido: string
  cedula: string | null
  edad_aproximada: number | null
  genero: string | null
  ultimo_lugar_visto: string | null
  informacion_adicional: string | null
  estado: import("@/lib/types/database").MissingPersonStatus
  motivo_fallecimiento: string | null
  fallecimiento_confirmado: boolean
  contacto_nombre: string
  contacto_apellido: string
  contacto_correo: string | null
  contacto_telefono_nacional: string | null
  contacto_telefono_internacional: string | null
  created_at: string
  updated_at: string
  missing_person_images?: MissingPersonSearchImage[]
}

/** Item de búsqueda de pacientes (forma paginada). */
export type PatientSearchInfo = Pick<
  CatastropheVictimInfo,
  | "triage_category"
  | "estado_destino"
  | "motivo_principal_consulta"
>

export type PatientSearchItem = Pick<
  CatastropheVictim,
  | "id"
  | "organization_id"
  | "nombre_completo"
  | "cedula"
  | "edad"
  | "genero"
  | "sector_comunidad"
  | "registration_number"
  | "notas"
  | "created_at"
  | "updated_at"
> & {
  catastrophe_victim_info?: PatientSearchInfo | PatientSearchInfo[] | null
}