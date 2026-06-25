"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- los render props son
   genéricos por diseño para usar con diferentes tipos de items */

import { type ReactNode } from "react"
import { useSearch, useInfiniteSentinel } from "./SearchProvider"
import type { FilterDef } from "@/lib/search/types"

/* ───────────────────────────────────────────────────────────────────────────
 * Bloques de UI del Search Core. Reutilizables por contexto y composable.
 * ─────────────────────────────────────────────────────────────────────── */

function Icon({ path, className = "" }: { path: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  )
}

const ICON = {
  search: "m21 21-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z",
  close: "M18 6 6 18M6 6l12 12",
  filter: "M4 6h16M7 12h10M10 18h4",
  spinner: "M21 12a9 9 0 1 1-6.219-8.56",
}

/* ── SearchBar ──────────────────────────────────────────────────────────── */

export function SearchBar({
  placeholder = "Buscar…",
  right,
  accent = "primary",
}: {
  placeholder?: string
  right?: ReactNode
  accent?: "primary" | "crisis"
}) {
  const { rawSearch, setRawSearch, state } = useSearch()
  const ring =
    accent === "crisis" ? "focus:ring-crisis/30 focus:border-crisis/50" : "focus:ring-primary-ring focus:border-primary"
  return (
    <div className="relative">
      <Icon path={ICON.search} className={`w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 ${state.loading ? "animate-pulse" : ""}`} />
      <input
        value={rawSearch}
        onChange={(e) => setRawSearch(e.target.value)}
        placeholder={placeholder}
        aria-label="Buscar"
        className={`w-full rounded-xl border border-border bg-muted/60 pl-11 pr-10 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 ${ring} focus:bg-card transition-colors`}
      />
      {rawSearch && (
        <button
          type="button"
          onClick={() => setRawSearch("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
          aria-label="Limpiar búsqueda"
        >
          <Icon path={ICON.close} className="w-4 h-4" />
        </button>
      )}
      {right}
    </div>
  )
}

/* ── FilterPanel ─────────────────────────────────────────────────────────── */

export function FilterPanel({
  className = "",
  layout = "stack",
}: {
  className?: string
  /** `stack` para sidebar lateral, `inline` para fila horizontal. */
  layout?: "stack" | "inline"
}) {
  const { config, state, setFilter } = useSearch()
  const base = layout === "stack" ? "flex flex-col gap-4" : "flex flex-wrap gap-2 items-center"
  return (
    <div className={`${base} ${className}`}>
      {config.filters.map((def) => (
        <FilterControl
          key={def.key}
          def={def}
          value={(state.filters as Record<string, string>)[def.key]}
          onChange={(v) => setFilter(def.key, v as any)}
        />
      ))}
    </div>
  )
}

function FilterControl({
  def,
  value,
  onChange,
}: {
  def: FilterDef<Record<string, unknown>>
  value: string | undefined
  onChange: (v: string) => void
}) {
  if (def.type === "select") {
    return (
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-gray-600">
        <span>{def.label}</span>
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-ring"
        >
          {def.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    )
  }
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-gray-600">
      <span>{def.label}</span>
      <input
        value={value ?? ""}
        placeholder={def.placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-ring"
      />
    </label>
  )
}

/* ── ActiveChips ─────────────────────────────────────────────────────────── */

export function ActiveChips() {
  const { config, state, removeFilter, rawSearch, setRawSearch } = useSearch()
  const defs = config.filters
  const active = state.filters
  const chips: Array<{ key: string; label: string; onRemove: () => void }> = []
  for (const [k, v] of Object.entries(active)) {
    const def = defs.find((f) => f.key === k)
    if (!def) continue
    const allValue = def.allValue ?? ""
    if (v && v !== allValue && v !== "") {
      const opt = def.options?.find((o) => o.value === String(v))
      chips.push({
        key: k,
        label: `${def.label}: ${opt?.label ?? String(v)}`,
        onRemove: () => removeFilter(k as any),
      })
    }
  }
  if (rawSearch.trim()) {
    chips.push({
      key: "_search",
      label: `“${rawSearch.trim()}”`,
      onRemove: () => setRawSearch(""),
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.onRemove}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-light text-primary-dark text-xs font-semibold px-3 py-1.5 hover:bg-primary/10 transition-colors"
        >
          {c.label}
          <Icon path={ICON.close} className="w-3 h-3" />
        </button>
      ))}
    </div>
  )
}

/* ── Estados vacíos / error ──────────────────────────────────────────────── */

export function ResultsState({
  emptyTitle,
  emptyHint,
  emptyAction,
}: {
  emptyTitle: string
  emptyHint?: string
  emptyAction?: ReactNode
}) {
  const { state } = useSearch()
  if (state.loadingInitial) return null
  if (state.error) {
    return (
      <p className="text-sm text-crisis bg-crisis/5 border border-crisis/20 rounded-xl px-4 py-3">
        {state.error}
      </p>
    )
  }
  if (state.items.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl border border-dashed border-border">
        <div className="w-14 h-14 rounded-2xl bg-primary-light text-primary/60 flex items-center justify-center mx-auto mb-4">
          <Icon path={ICON.search} className="w-7 h-7" />
        </div>
        <p className="text-gray-600 font-medium">{emptyTitle}</p>
        {emptyHint && <p className="text-sm text-gray-400 mt-1">{emptyHint}</p>}
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    )
  }
  return null
}

/* ── ResultsGrid (infinite scroll) ─────────────────────────────────────── */

export function ResultsGrid({
  columns = "sm:grid-cols-2 lg:grid-cols-3",
  gap = "gap-4 sm:gap-5",
  renderItem,
  skeleton,
  skeletonCount = 6,
}: {
  columns?: string
  gap?: string
  renderItem: (item: any, index: number) => ReactNode
  skeleton: ReactNode
  skeletonCount?: number
}) {
  const { config, state, loadMore } = useSearch()
  const paginated = config.paginationMode === "pages"
  // En modo "pages" el centinela no debe disparar cargas (hasMore se ignora).
  const sentinel = useInfiniteSentinel(loadMore, !paginated && state.hasMore, state.loading)

  if (state.loadingInitial) {
    return (
      <div className={`grid grid-cols-1 ${columns} ${gap}`}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i}>{skeleton}</div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className={`grid grid-cols-1 ${columns} ${gap}`}>
        {state.items.map((it, i) => renderItem(it, i))}
      </div>

      {paginated ? null : (
        <>
          {/* Centinela del infinite scroll. Rootmargin 600px → carga anticipada. */}
          <div ref={sentinel} className="h-1 w-full" aria-hidden />
          {state.loading && !state.loadingInitial && (
            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500">
              <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Cargando más…
            </div>
          )}
          {!state.hasMore && state.items.length > 0 && (
            <p className="mt-8 text-center text-xs text-gray-400">
              Has llegado al final del registro.
            </p>
          )}
        </>
      )}
    </>
  )
}

/* ── Pagination (modo "pages": páginas numeradas) ───────────────────────── */

/** Genera la secuencia de páginas con elipsis: 1 … 4 5 [6] 7 8 … 20. */
function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "…")[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push("…")
  for (let p = start; p <= end; p++) pages.push(p)
  if (end < total - 1) pages.push("…")
  pages.push(total)
  return pages
}

export function Pagination({ accent = "primary" }: { accent?: "primary" | "crisis" }) {
  const { state, goToPage } = useSearch()
  if (state.loadingInitial || state.totalPages <= 1) return null

  const { page, totalPages } = state
  const activeBg = accent === "crisis" ? "bg-crisis text-white" : "bg-primary text-white"
  const arrow =
    "inline-flex items-center justify-center h-9 min-w-9 px-2.5 rounded-lg border border-border text-sm font-medium text-gray-600 hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-gray-600 transition-colors"

  return (
    <nav
      className="mt-10 flex flex-wrap items-center justify-center gap-1.5"
      aria-label="Paginación"
    >
      <button
        type="button"
        onClick={() => goToPage(page - 1)}
        disabled={page <= 1 || state.loading}
        className={arrow}
        aria-label="Página anterior"
      >
        <Icon path="M15 18l-6-6 6-6" className="w-4 h-4" />
      </button>

      {pageList(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1.5 text-sm text-gray-400 select-none">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => goToPage(p)}
            disabled={state.loading}
            aria-current={p === page ? "page" : undefined}
            className={`h-9 min-w-9 px-2.5 rounded-lg text-sm font-semibold transition-colors ${
              p === page
                ? activeBg
                : "border border-border text-gray-600 hover:border-primary/40 hover:text-primary"
            }`}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => goToPage(page + 1)}
        disabled={page >= totalPages || state.loading}
        className={arrow}
        aria-label="Página siguiente"
      >
        <Icon path="M9 18l6-6-6-6" className="w-4 h-4" />
      </button>
    </nav>
  )
}

/* ── ResultsList (virtualizado con content-visibility) ─────────────────── */
/**
 * Virtualización sin librería: cada fila usa `content-visibility: auto` +
 * `contain-intrinsic-size`, lo que evita renderizar/layout/paintar filas
 * fuera de viewport. Soporta miles de filas con coste ~constante y senso
 * de scroll nativo (no calculamos posiciones manualmente).
 */
export function ResultsList({
  rowHeight = 80,
  maxHeight = "60vh",
  renderRow,
  skeleton,
  skeletonCount = 6,
  emptyFallback,
}: {
  rowHeight?: number
  maxHeight?: string
  renderRow: (item: any, index: number) => ReactNode
  skeleton: ReactNode
  skeletonCount?: number
  emptyFallback?: ReactNode
}) {
  const { state, loadMore } = useSearch()
  const sentinel = useInfiniteSentinel(loadMore, state.hasMore, state.loading)

  if (state.loadingInitial) {
    return (
      <div style={{ maxHeight }} className="overflow-y-auto overscroll-contain">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="border-b border-border">
            {skeleton}
          </div>
        ))}
      </div>
    )
  }

  if (state.items.length === 0) {
    return emptyFallback ? <>{emptyFallback}</> : null
  }

  return (
    <div
      style={{ maxHeight }}
      className="overflow-y-auto overscroll-contain rounded-xl border border-border"
    >
      <ul className="divide-y divide-border">
        {state.items.map((it, i) => (
          // content-visibility: el navegador salta el render/layout/paint de
          // filas fuera de viewport → lista virtualizada sin cálculo manual.
          <li
            key={(it as any).id ?? i}
            style={{
              contentVisibility: "auto",
              containIntrinsicSize: `auto ${rowHeight}px`,
            }}
            className="min-h-0"
          >
            {renderRow(it, i)}
          </li>
        ))}
      </ul>
      <div ref={sentinel} className="h-1 w-full" aria-hidden />
      {state.loading && !state.loadingInitial && (
        <div className="py-3 flex items-center justify-center gap-2 text-xs text-gray-500">
          <span className="inline-block w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Cargando más…
        </div>
      )}
      {!state.hasMore && (
        <p className="py-3 text-center text-[11px] text-gray-400">
          Fin de la lista.
        </p>
      )}
    </div>
  )
}

/* ── ResultCount: badges de resultados (útil antes del grid) ────────────── */

export function ResultCount({
  loadingLabel = "Cargando…",
  formatter,
}: {
  loadingLabel?: string
  formatter: (count: number) => string
}) {
  const { config, state } = useSearch()
  if (state.loadingInitial && state.items.length === 0) {
    return <span className="text-sm font-medium text-gray-500">{loadingLabel}</span>
  }
  // En modo "pages" el backend da el total exacto; en "infinite" usamos lo cargado.
  const count = config.paginationMode === "pages" ? state.total : state.items.length
  return <span className="text-sm font-medium text-gray-500">{formatter(count)}</span>
}