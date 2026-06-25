"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useDeferredValue,
  type ReactNode,
} from "react"
import type {
  SearchConfig,
  SearchState,
} from "@/lib/search/types"

/* ───────────────────────────────────────────────────────────────────────────
 * SearchProvider — motor único de búsqueda.
 *
 * Estado centralizado con cursor pagination: carga la primera página
 * automáticamente, expone `loadMore()` para infinite scroll, mutation de
 * filtros con reset a la página 0 y búsqueda debounced (useDeferredValue
 * + AbortController para no acumular fetches obsoletos).
 * ─────────────────────────────────────────────────────────────────────── */

type CtxShape<TItem, TFilters extends Record<string, unknown>> = {
  config: SearchConfig<TItem, TFilters>
  state: SearchState<TItem, TFilters>
  /** Término crudo que el usuario está escribiendo (sin debounce). */
  rawSearch: string
  setRawSearch: (v: string) => void
  setSearch: (v: string) => void
  setFilter: <K extends keyof TFilters & string>(key: K, value: TFilters[K]) => void
  removeFilter: <K extends keyof TFilters & string>(key: K) => void
  clearAll: () => void
  loadMore: () => void
  /** Modo "pages": salta a una página concreta (1-based). */
  goToPage: (page: number) => void
  reload: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- contexto genérico (patrón estándar de React)
const SearchCtx = createContext<CtxShape<any, any> | null>(null)

export function SearchProvider<
  TItem,
  TFilters extends Record<string, unknown>,
>({
  config,
  initialSearch = "",
  initialFilters,
  children,
}: {
  config: SearchConfig<TItem, TFilters>
  initialSearch?: string
  /** Sobrescribe config.initialFilters para este contexto concreto. */
  initialFilters?: TFilters
  children: ReactNode
}) {
  const mode = config.paginationMode ?? "infinite"

  const [rawSearch, setRawSearch] = useState(initialSearch)
  // useDeferredValue: el input sigue siendo responsivo aunque el fetch sea lento.
  const search = useDeferredValue(rawSearch)

  const [items, setItems] = useState<TItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<TFilters>(initialFilters ?? config.initialFilters)
  // Estado del modo "pages" (páginas numeradas).
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // AbortController en vuelo para cancelar fetches obsoletos → sin parpadeos.
  const inflightRef = useRef<AbortController | null>(null)
  // Token para descartar respuestas de páginas "antiguas" cuando cambian
  // filtros/search mientras un loadMore estaba pendiente.
  const epochRef = useRef(0)

  // Limpia el fetch en vuelo y dispara un refresh.
  // En modo "infinite" siempre carga la primera página (cursor null).
  // En modo "pages" carga la página `pageNum` (replace, no append).
  const runFirstPage = useCallback(
    async (searchTerm: string, currentFilters: TFilters, pageNum = 1) => {
      const myEpoch = ++epochRef.current
      inflightRef.current?.abort()
      const ac = new AbortController()
      inflightRef.current = ac

      setLoadingInitial(true)
      try {
        const url = config.buildQuery({
          search: searchTerm,
          filters: currentFilters,
          cursor: null,
          page: mode === "pages" ? pageNum : null,
          pageSize: config.pageSize,
        })
        const res = await fetch(url, { signal: ac.signal, cache: "no-store" })
        const json = await res.json()
        if (myEpoch !== epochRef.current) return // descartado

        const parsed = config.parseResponse(json)
        if (parsed.error) {
          setError(parsed.error)
          setItems([])
          setNextCursor(null)
          setHasMore(false)
          if (mode === "pages") { setTotal(0); setTotalPages(1) }
          return
        }
        setError(null)
        setItems(parsed.items)
        setNextCursor(parsed.next_cursor)
        setHasMore(parsed.has_more)
        if (mode === "pages") {
          setPage(pageNum)
          setTotal(parsed.total ?? parsed.items.length)
          setTotalPages(parsed.total_pages ?? 1)
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        setError(err instanceof Error ? err.message : "Error de búsqueda")
        setItems([])
        setHasMore(false)
      } finally {
        if (myEpoch === epochRef.current) setLoadingInitial(false)
      }
    },
    [config, mode],
  )

  // Re-corre la búsqueda (vuelve a página 1) cuando cambia search o filtros.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void runFirstPage(search, filters, 1)
  }, [search, filters, runFirstPage])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Limpieza al desmontar.
  useEffect(() => () => inflightRef.current?.abort(), [])

  const loadMore = useCallback(async () => {
    if (loadingMore || loadingInitial || !hasMore || !nextCursor) return
    setLoadingMore(true)
    try {
      const url = config.buildQuery({
        search,
        filters,
        cursor: nextCursor,
        page: null,
        pageSize: config.pageSize,
      })
      const res = await fetch(url, { cache: "no-store" })
      const json = await res.json()
      const parsed = config.parseResponse(json)
      if (parsed.error) {
        setError(parsed.error)
        return
      }
      setError(null)
      setItems((prev) => {
        // Dedupe por id (defensivo, ante empates de cursor que re-soltara filas).
        const seen = new Set(
          prev.map((p) => (p as Record<string, unknown>).id as string),
        )
        const fresh = parsed.items.filter(
          (it) => !seen.has((it as Record<string, unknown>).id as string),
        )
        return [...prev, ...fresh]
      })
      setNextCursor(parsed.next_cursor)
      setHasMore(parsed.has_more)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar más")
    } finally {
      setLoadingMore(false)
    }
  }, [config, search, filters, hasMore, nextCursor, loadingMore, loadingInitial])

  const setFilter = useCallback(
    <K extends keyof TFilters & string>(key: K, value: TFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const removeFilter = useCallback(<K extends keyof TFilters & string>(key: K) => {
    setFilters((prev) => {
      const def = config.filters.find((f) => f.key === key)
      const override = initialFilters?.[key]
      const reset = override !== undefined ? override : ((def?.allValue ?? "") as TFilters[K])
      return { ...prev, [key]: reset }
    })
  }, [config, initialFilters])

  const clearAll = useCallback(() => {
    setFilters(initialFilters ?? config.initialFilters)
    setRawSearch("")
  }, [config, initialFilters])

  const goToPage = useCallback(
    (target: number) => {
      const clamped = Math.max(1, Math.min(totalPages, target))
      if (clamped === page) return
      // Subir al inicio del listado al cambiar de página (UX de paginación).
      if (typeof window !== "undefined") {
        window.scrollTo({ top: window.scrollY, behavior: "auto" })
      }
      void runFirstPage(search, filters, clamped)
    },
    [runFirstPage, search, filters, totalPages, page],
  )

  const reload = useCallback(() => {
    void runFirstPage(search, filters, page)
  }, [runFirstPage, search, filters, page])

  const state = useMemo<SearchState<TItem, TFilters>>(
    () => ({
      search,
      items,
      nextCursor,
      hasMore,
      loading: loadingInitial || loadingMore,
      loadingInitial,
      error,
      filters,
      page,
      total,
      totalPages,
    }),
    [search, items, nextCursor, hasMore, loadingInitial, loadingMore, error, filters, page, total, totalPages],
  )

  const value = useMemo<CtxShape<TItem, TFilters>>(
    () => ({
      config,
      state,
      rawSearch,
      setRawSearch,
      setSearch: setRawSearch,
      setFilter,
      removeFilter,
      clearAll,
      loadMore,
      goToPage,
      reload,
    }),
    [config, state, rawSearch, setFilter, removeFilter, clearAll, loadMore, goToPage, reload],
  )

  return <SearchCtx.Provider value={value}>{children}</SearchCtx.Provider>
}

export function useSearch<TItem, TFilters extends Record<string, unknown>>() {
  const ctx = useContext(SearchCtx) as CtxShape<TItem, TFilters> | null
  if (!ctx) {
    throw new Error("useSearch debe usarse dentro de <SearchProvider>")
  }
  return ctx
}

/** Hook utilitario: IntersectionObserver para disparar loadMore 自动. */
export function useInfiniteSentinel(
  loadMore: () => void,
  hasMore: boolean,
  loading: boolean,
) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !hasMore || loading) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: "600px 0px", threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [loadMore, hasMore, loading])
  return ref
}