import type { SearchConfig } from "@/lib/search/types"
import {
  type MissingPersonSearchItem,
  type PatientSearchItem,
} from "@/lib/search/types"
import { STATUS_META } from "@/lib/missing-persons"
import { getClientOrganizationId } from "@/lib/config"
import type { MissingPersonStatus } from "@/lib/types/database"

/* ───────────────────────────────────────────────────────────────────────────
 * Configuraciones por contexto.
 *
 * Una sola API (SearchProvider) consume estas configs. Cambiar filtros,
 * endpoint o vista NO requiere duplicar lógica de búsqueda.
 * ─────────────────────────────────────────────────────────────────────── */

/* ── Filtrados declarativos (definidos primero para evitar TDZ) ──────────── */

export type MissingPersonsFilters = {
  estado: string // "todos" | estado…
}

export const missingPersonsFilters: MissingPersonsFilters = {
  estado: "todos",
}

export type PatientsFilters = {
  triage_level: string // "todos" | Verde | Amarillo | Rojo
  genero: string // "todos" | M | F | Otro
  cedula: string // texto libre (ilike)
  edad_min: string // texto numérico
  edad_max: string // texto numérico
}

export const patientsFilters: PatientsFilters = {
  triage_level: "todos",
  genero: "todos",
  cedula: "",
  edad_min: "",
  edad_max: "",
}

export const missingPersonsFilterDefs = [
  {
    key: "estado" as const,
    label: "Estado",
    type: "select" as const,
    allValue: "todos",
    options: [
      { value: "todos", label: "Todos los estados" },
      ...(Object.keys(STATUS_META) as MissingPersonStatus[]).map((e) => ({
        value: e,
        label: STATUS_META[e].label,
      })),
    ],
  },
] as const

export const patientsFilterDefs = [
  {
    key: "triage_level" as const,
    label: "Nivel de triaje",
    type: "select" as const,
    allValue: "todos",
    options: [
      { value: "todos", label: "Todos los niveles" },
      { value: "Rojo", label: "🔴 Rojo — Emergencia" },
      { value: "Amarillo", label: "🟡 Amarillo — Moderado" },
      { value: "Verde", label: "🟢 Verde — Leve" },
    ],
  },
  {
    key: "genero" as const,
    label: "Género",
    type: "select" as const,
    allValue: "todos",
    options: [
      { value: "todos", label: "Todos" },
      { value: "M", label: "Masculino" },
      { value: "F", label: "Femenino" },
      { value: "Otro", label: "Otro" },
    ],
  },
  {
    key: "cedula" as const,
    label: "Cédula",
    type: "text" as const,
    allValue: "",
    placeholder: "V-00000000",
  },
  {
    key: "edad_min" as const,
    label: "Edad mín.",
    type: "text" as const,
    allValue: "",
    placeholder: "0",
  },
  {
    key: "edad_max" as const,
    label: "Edad máx.",
    type: "text" as const,
    allValue: "",
    placeholder: "120",
  },
] as const

/* ── Personas desaparecidas (grid · infinite scroll) ────────────────────── */

export const missingPersonsConfig: SearchConfig<
  MissingPersonSearchItem,
  MissingPersonsFilters
> = {
  entity: "missing_persons",
  endpoint: "/api/missing-persons",
  pageSize: 12,
  view: "grid",
  initialFilters: { estado: "todos" },
  filters: [...missingPersonsFilterDefs],
  buildQuery: ({ search, filters, cursor, pageSize }) => {
    const p = new URLSearchParams({ limit: String(pageSize) })
    if (search.trim()) p.set("search", search.trim())
    if (filters.estado && filters.estado !== "todos") p.set("estado", filters.estado)
    if (cursor) p.set("cursor", cursor)
    return `/api/missing-persons?${p.toString()}`
  },
  parseResponse: (json) => {
    const r = (json ?? {}) as Partial<{
      items: MissingPersonSearchItem[]
      next_cursor: string | null
      has_more: boolean
      error: string | null
    }>
    return {
      items: r.items ?? [],
      next_cursor: r.next_cursor ?? null,
      has_more: r.has_more ?? false,
      error: r.error ?? null,
    }
  },
  searchDebounceMs: 250,
}

/* ── Personas registradas — landing (grid · paginación numerada) ────────── */

export const missingPersonsPagedConfig: SearchConfig<
  MissingPersonSearchItem,
  MissingPersonsFilters
> = {
  entity: "missing_persons",
  endpoint: "/api/missing-persons",
  pageSize: 12,
  view: "grid",
  paginationMode: "pages",
  initialFilters: { estado: "todos" },
  filters: [...missingPersonsFilterDefs],
  buildQuery: ({ search, filters, page, pageSize }) => {
    const p = new URLSearchParams({
      limit: String(pageSize),
      page: String(page ?? 1),
    })
    if (search.trim()) p.set("search", search.trim())
    if (filters.estado && filters.estado !== "todos") p.set("estado", filters.estado)
    return `/api/missing-persons?${p.toString()}`
  },
  parseResponse: (json) => {
    const r = (json ?? {}) as Partial<{
      items: MissingPersonSearchItem[]
      total: number
      total_pages: number
      has_more: boolean
      error: string | null
    }>
    return {
      items: r.items ?? [],
      next_cursor: null,
      has_more: r.has_more ?? false,
      total: r.total ?? 0,
      total_pages: r.total_pages ?? 1,
      error: r.error ?? null,
    }
  },
  searchDebounceMs: 250,
}

/* ── Pacientes (list · virtualized scroll) ──────────────────────────────── */

export const patientsConfig: SearchConfig<
  PatientSearchItem,
  PatientsFilters
> = {
  entity: "patients",
  endpoint: "/api/catastrophe/victims",
  pageSize: 25,
  view: "list",
  initialFilters: { triage_level: "todos", genero: "todos", cedula: "", edad_min: "", edad_max: "" },
  filters: [...patientsFilterDefs],
  buildQuery: ({ search, filters, cursor, pageSize }) => {
    const orgId = getClientOrganizationId()
    const p = new URLSearchParams({
      organization_id: orgId,
      limit: String(pageSize),
    })
    if (search.trim()) p.set("search", search.trim())
    if (filters.triage_level && filters.triage_level !== "todos") {
      p.set("triage_level", filters.triage_level)
    }
    if (filters.genero && filters.genero !== "todos") p.set("genero", filters.genero)
    if (filters.cedula.trim()) p.set("cedula", filters.cedula.trim())
    if (filters.edad_min.trim()) p.set("edad_min", filters.edad_min.trim())
    if (filters.edad_max.trim()) p.set("edad_max", filters.edad_max.trim())
    if (cursor) p.set("cursor", cursor)
    return `/api/catastrophe/victims?${p.toString()}`
  },
  parseResponse: (json) => {
    const r = (json ?? {}) as Partial<{
      items: PatientSearchItem[]
      next_cursor: string | null
      has_more: boolean
      error: string | null
    }>
    return {
      items: r.items ?? [],
      next_cursor: r.next_cursor ?? null,
      has_more: r.has_more ?? false,
      error: r.error ?? null,
    }
  },
  searchDebounceMs: 250,
}