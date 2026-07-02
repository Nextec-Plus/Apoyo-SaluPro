# Ayudas Pagination + Report Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real page-number pagination + filtered total count to the "Ayudas entregadas" table, and add stakeholder-facing charts (bar, pie, daily trend) to the "Reporte de Ayudas" card and its PDF export.

**Architecture:** Part A swaps the `ayuda_entregas` list endpoint from cursor pagination to page/page_size pagination with an exact filtered count (single Supabase query using `{ count: "exact" }`), and adds page controls to `TabAyudas`. Part B adds a `porDia` field to the existing `AyudasReporteSummary`, builds three `recharts` components in a new isolated client file, wires them into `AyudasReporteCard`, and reuses the existing `drawHorizontalBarChart` PDF helper for the exportable version.

**Tech Stack:** Next.js route handlers, Supabase, `recharts` (already in `package.json`), existing `lib/reportes/pdf-charts.ts` helpers, React.

## Global Constraints

- No test framework in this repo — verification uses `npx tsc --noEmit`, `npm run lint`, `npm run build`, and manual browser checks (same as the prior ayudas-report plan).
- `page_size` accepted values: `12, 25, 50, 100, 500`; default `12`. Any other value falls back to `12`.
- Categorical chart palette (fixed order, never cycled, from the project's `dataviz` skill reference palette): `#2a78d6, #1baf7a, #eda100, #008300, #4a3aa7, #e34948, #e87ba4, #eb6834`. Position 9+ (and the pie's "Otros" slice) uses `#898781` (muted gray).
- Only `tab-ayudas.tsx` calls `GET /api/catastrophe/ayudas` (confirmed via repo-wide search) — safe to drop `cursor`/`next_cursor`/`has_more` from that route without breaking other callers.
- All dates in `porDia` are VET (`America/Caracas`) `YYYY-MM-DD` strings, matching the rest of `lib/reportes/ayudas/`.

---

### Task 1: Page-based pagination + filtered count on `GET /api/catastrophe/ayudas`

**Files:**
- Modify: `apoyo-salupro/app/api/catastrophe/ayudas/route.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `GET` response shape `{ data: EntregaRow[] | null; total: number; page: number; page_size: number; error: string | null }` — consumed by Task 2 (`loadRows` in `tab-ayudas.tsx`).

- [ ] **Step 1: Replace the cursor-based `GET` handler**

Read the current file first (`apoyo-salupro/app/api/catastrophe/ayudas/route.ts`) to confirm line ranges, then replace the entire `GET` function (currently lines 14-62) with:

```typescript
const PAGE_SIZES = new Set([12, 25, 50, 100, 500]);

/**
 * GET /api/catastrophe/ayudas
 * Lista entregas de ayuda con sus items (incluye nombre del tipo), paginado
 * por página. Filtros: organization_id (requerido), cedula (búsqueda
 * parcial), nombre (búsqueda parcial), tipo_id (solo entregas que incluyan
 * ese tipo). Paginación: page (default 1), page_size (12|25|50|100|500,
 * default 12). Devuelve `total` = cantidad de entregas que matchean los
 * filtros (sin paginar).
 */
export async function GET(request: NextRequest) {
  const supabase = await createServiceClient()
  const { searchParams } = request.nextUrl

  const organization_id = searchParams.get('organization_id')
  const cedula = searchParams.get('cedula')
  const nombre = searchParams.get('nombre')
  const tipoId = searchParams.get('tipo_id')
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const rawPageSize = Number(searchParams.get('page_size'))
  const page_size = PAGE_SIZES.has(rawPageSize) ? rawPageSize : 12

  if (!organization_id) {
    return Response.json({ data: null, total: 0, page, page_size, error: 'organization_id es requerido' }, { status: 400 })
  }

  // !inner cuando filtramos por tipo_id → PostgREST descarta entregas que no
  // tengan ningún item de ese tipo (un LEFT JOIN normal no lo hace).
  const itemsJoin = tipoId
    ? 'ayuda_entrega_items!inner(*, ayuda_tipos(id, nombre))'
    : 'ayuda_entrega_items(*, ayuda_tipos(id, nombre))'

  let query = supabase
    .from('ayuda_entregas')
    .select(`*, ${itemsJoin}`, { count: 'exact' })
    .eq('organization_id', organization_id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (cedula) query = query.ilike('cedula', `%${onlyDigits(cedula)}%`)
  if (nombre) query = query.ilike('nombre_completo', `%${nombre.trim()}%`)
  if (tipoId) query = query.eq('ayuda_entrega_items.tipo_id', tipoId)

  const from = (page - 1) * page_size
  const to = from + page_size - 1
  query = query.range(from, to)

  const { data, count, error } = await query
  if (error) return Response.json({ data: null, total: 0, page, page_size, error: error.message }, { status: 500 })

  return Response.json({ data, total: count ?? 0, page, page_size, error: null })
}
```

Keep the `onlyDigits` helper and the `POST` handler in the file unchanged.

- [ ] **Step 2: Typecheck**

Run (from `apoyo-salupro/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no errors referencing `app/api/catastrophe/ayudas/route.ts`.

- [ ] **Step 3: Manual verification**

With `npm run dev` running and a valid session cookie:
`curl "http://localhost:3000/api/catastrophe/ayudas?organization_id=<org-id>&page=1&page_size=12" -H "Cookie: <cookie>"`
Expected: `200`, JSON with `data` (≤12 items), `total` (full count), `page: 1`, `page_size: 12`.
`curl "http://localhost:3000/api/catastrophe/ayudas?organization_id=<org-id>&page=1&page_size=12&nombre=maria" -H "Cookie: <cookie>"`
Expected: `total` reflects only rows matching `nombre ilike %maria%`.

- [ ] **Step 4: Commit**

```bash
git add apoyo-salupro/app/api/catastrophe/ayudas/route.ts
git commit -m "feat(ayudas): switch entregas list endpoint to page-based pagination with total count"
```

---

### Task 2: Pagination UI in `TabAyudas` "Ayudas entregadas"

**Files:**
- Modify: `apoyo-salupro/app/dashboard/tabs/tab-ayudas.tsx`

**Interfaces:**
- Consumes: `GET /api/catastrophe/ayudas?...&page=&page_size=` from Task 1, response `{ data, total, page, page_size, error }`.
- Produces: nothing consumed elsewhere (leaf UI change).

- [ ] **Step 1: Add pagination state and update `loadRows`**

In `apoyo-salupro/app/dashboard/tabs/tab-ayudas.tsx`, replace the block at lines 173-197:

```typescript
  /* ── Tabla de registros ────────────────────────────────────────────── */
  const [rows, setRows] = useState<EntregaRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [searchCedula, setSearchCedula] = useState("");
  const [searchNombre, setSearchNombre] = useState("");
  const [filterTipoId, setFilterTipoId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [total, setTotal] = useState(0);

  const loadRows = useCallback(async (filtros?: { cedula?: string; nombre?: string; tipoId?: string; page?: number; pageSize?: number }) => {
    setLoadingRows(true);
    try {
      const organization_id = getClientOrganizationId();
      const params = new URLSearchParams({
        organization_id,
        page: String(filtros?.page ?? 1),
        page_size: String(filtros?.pageSize ?? 12),
      });
      if (filtros?.cedula) params.set("cedula", filtros.cedula);
      if (filtros?.nombre) params.set("nombre", filtros.nombre);
      if (filtros?.tipoId) params.set("tipo_id", filtros.tipoId);
      const res = await fetch(`/api/catastrophe/ayudas?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRows(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los registros");
    } finally {
      setLoadingRows(false);
    }
  }, [toast]);
```

- [ ] **Step 2: Reset to page 1 on filter/page-size change, refetch on page change**

Replace the two `useEffect` calls right after (originally lines 199-207):

```typescript
  useEffect(() => {
    loadRows({ cedula: searchCedula || undefined, nombre: searchNombre || undefined, tipoId: filterTipoId || undefined, page, pageSize });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    setPage(1);
    const t = setTimeout(
      () => loadRows({ cedula: searchCedula || undefined, nombre: searchNombre || undefined, tipoId: filterTipoId || undefined, page: 1, pageSize }),
      350,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCedula, searchNombre, filterTipoId, pageSize]);
```

- [ ] **Step 3: Update the post-submit refresh call**

`handleSubmit` (search for `loadRows({ cedula: searchCedula || undefined, nombre: searchNombre || undefined, tipoId: filterTipoId || undefined });` inside it) currently calls `loadRows` with only filters after registering a new ayuda. Update that single call site to also pass pagination and reset to page 1:

```typescript
      setPage(1);
      loadRows({ cedula: searchCedula || undefined, nombre: searchNombre || undefined, tipoId: filterTipoId || undefined, page: 1, pageSize });
```

- [ ] **Step 4: Add total count + pagination controls around the table**

Find the "Ayudas entregadas" header block (search for `AYUDAS ENTREGADAS` — currently around line 475):

```typescript
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              Ayudas entregadas
            </h3>
```

Replace with (adds the small total count next to the heading):

```typescript
            <div className="flex items-baseline gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                Ayudas entregadas
              </h3>
              <span className="text-xs text-gray-400">
                · {total.toLocaleString("es-VE")} persona{total === 1 ? "" : "s"} ayudada{total === 1 ? "" : "s"}
              </span>
            </div>
```

Then, right after the closing `</table></div>` of the results table and before the subview's closing `</div>` (the block currently ends around line 540 with the `{loadingRows ? (...) : rows.length === 0 ? (...) : (<div className="overflow-x-auto -mx-2">...</table></div>)}`), add pagination controls immediately after that conditional block, still inside the `entregadas` subview `<div>`:

```typescript
          {!loadingRows && total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-border">
              <label className="flex items-center gap-2 text-xs text-gray-500">
                Filas por página
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="text-xs bg-white border border-border rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary"
                >
                  {[12, 25, 50, 100, 500].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>

              <PageNumbers
                page={page}
                totalPages={Math.max(1, Math.ceil(total / pageSize))}
                onChange={setPage}
              />
            </div>
          )}
```

- [ ] **Step 5: Add the `PageNumbers` helper component**

Insert this component in `apoyo-salupro/app/dashboard/tabs/tab-ayudas.tsx`, right before `export function TabAyudas()` (search for `type SubView = "registrar" | "entregadas";` — insert after that line, before `export function TabAyudas`):

```typescript
function pageRange(page: number, totalPages: number): (number | "…")[] {
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const withGaps: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) withGaps.push("…");
    withGaps.push(p);
    prev = p;
  }
  return withGaps;
}

function PageNumbers({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="text-xs font-semibold text-gray-500 rounded-md px-2 py-1 hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
      >
        ‹
      </button>
      {pageRange(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="text-xs text-gray-300 px-1">…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`text-xs font-semibold rounded-md px-2.5 py-1 ${
              p === page ? "bg-primary text-white" : "text-gray-500 hover:bg-muted"
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="text-xs font-semibold text-gray-500 rounded-md px-2 py-1 hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
      >
        ›
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json` (from `apoyo-salupro/`)
Expected: no errors referencing `tab-ayudas.tsx`.

- [ ] **Step 7: Manual browser verification**

With `npm run dev` running, open the Ayudas tab → "Ayudas entregadas": total count shows next to the heading; changing "Filas por página" resets to page 1 and reloads; page numbers navigate correctly; searching by nombre/cédula resets to page 1 and updates total.

- [ ] **Step 8: Commit**

```bash
git add apoyo-salupro/app/dashboard/tabs/tab-ayudas.tsx
git commit -m "feat(ayudas): add page-number pagination and filtered total to entregadas table"
```

---

### Task 3: Add `porDia` to the ayudas report summary

**Files:**
- Modify: `apoyo-salupro/lib/reportes/ayudas/export-data.ts`

**Interfaces:**
- Consumes: nothing new (extends existing `buildAyudasReportePayload`).
- Produces: `AyudasReporteSummary.porDia: { fecha: string; cantidad: number }[]` (ascending by fecha, VET, zero-filled for days with no entregas) — consumed by Task 4 (chart component) and Task 6 (`AyudasReporteCard`).

- [ ] **Step 1: Extend the summary type and computation**

In `apoyo-salupro/lib/reportes/ayudas/export-data.ts`, update the `AyudasReporteSummary` type:

```typescript
export type AyudasReporteSummary = {
  totalEntregas: number;
  totalPersonasUnicas: number;
  porTipo: { nombre: string; cantidad: number }[];
  porDia: { fecha: string; cantidad: number }[];
};
```

Add a helper right after `fmtFecha`:

```typescript
function fechaVetOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(new Date(iso));
}

function addDaysVet(fechaVet: string, days: number): string {
  const [y, m, d] = fechaVet.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
```

In `buildAyudasReportePayload`, after the `porTipo` computation and before the `return`, add:

```typescript
  const porDiaMap = new Map<string, number>();
  for (const entrega of data) {
    const fecha = fechaVetOf(entrega.created_at);
    porDiaMap.set(fecha, (porDiaMap.get(fecha) ?? 0) + 1);
  }
  const porDia: { fecha: string; cantidad: number }[] = [];
  for (let fecha = startVet; fecha <= endVet; fecha = addDaysVet(fecha, 1)) {
    porDia.push({ fecha, cantidad: porDiaMap.get(fecha) ?? 0 });
  }
```

Update the `summary` field in the returned object:

```typescript
    summary: {
      totalEntregas: data.length,
      totalPersonasUnicas: cedulasUnicas.size,
      porTipo,
      porDia,
    },
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json` (from `apoyo-salupro/`)
Expected: no errors referencing `lib/reportes/ayudas/export-data.ts` or its consumers (`summary/route.ts`, `export/route.ts`, `pdf.ts` — the latter two are updated in Tasks 5-6, so transient errors there are expected until those tasks land; if this task is executed standalone, confirm no error specifically in `export-data.ts`).

- [ ] **Step 3: Commit**

```bash
git add apoyo-salupro/lib/reportes/ayudas/export-data.ts
git commit -m "feat(reportes): add daily breakdown (porDia) to ayudas report summary"
```

---

### Task 4: Chart components (`ayudas-reporte-charts.tsx`)

**Files:**
- Create: `apoyo-salupro/app/dashboard/tabs/ayudas-reporte-charts.tsx`

**Interfaces:**
- Consumes: `AyudasReporteSummary` type (re-exported here, imported by `tab-reportes.tsx` in Task 6 to avoid duplicating the shape — see Task 6 Step 1).
- Produces: `TiposBarChart({ porTipo })`, `TiposPieChart({ porTipo })`, `PersonasPorDiaChart({ porDia })`, plus `AYUDAS_CATEGORICAL_PALETTE` and `AYUDAS_OTROS_COLOR` constants — all used by Task 6.

- [ ] **Step 1: Write the chart file**

```typescript
// apoyo-salupro/app/dashboard/tabs/ayudas-reporte-charts.tsx
"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const AYUDAS_CATEGORICAL_PALETTE = [
  "#2a78d6",
  "#1baf7a",
  "#eda100",
  "#008300",
  "#4a3aa7",
  "#e34948",
  "#e87ba4",
  "#eb6834",
] as const;

export const AYUDAS_OTROS_COLOR = "#898781";

export type PorTipoEntry = { nombre: string; cantidad: number };
export type PorDiaEntry = { fecha: string; cantidad: number };

function colorForIndex(i: number): string {
  return i < AYUDAS_CATEGORICAL_PALETTE.length ? AYUDAS_CATEGORICAL_PALETTE[i] : AYUDAS_OTROS_COLOR;
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-xs text-gray-400 py-6 text-center">{text}</p>;
}

export function TiposBarChart({ porTipo }: { porTipo: PorTipoEntry[] }) {
  if (porTipo.length === 0) return <EmptyState text="Sin ayudas registradas en este rango." />;

  const rowH = 28;
  const height = Math.max(120, porTipo.length * rowH);

  return (
    <div className={porTipo.length > 10 ? "max-h-[320px] overflow-y-auto pr-1" : ""}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={porTipo} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="#e5e7eb" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#898781" }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="nombre"
            width={140}
            tick={{ fontSize: 11, fill: "#374151" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number) => [value.toLocaleString("es-VE"), "Cantidad"]}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e5e7eb" }}
          />
          <Bar dataKey="cantidad" radius={[0, 4, 4, 0]} barSize={16}>
            {porTipo.map((entry, i) => (
              <Cell key={entry.nombre} fill={colorForIndex(i)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TiposPieChart({ porTipo }: { porTipo: PorTipoEntry[] }) {
  if (porTipo.length === 0) return <EmptyState text="Sin ayudas registradas en este rango." />;

  const top = porTipo.slice(0, 8);
  const restoTotal = porTipo.slice(8).reduce((sum, t) => sum + t.cantidad, 0);
  const slices = restoTotal > 0 ? [...top, { nombre: "Otros", cantidad: restoTotal }] : top;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="cantidad"
          nameKey="nombre"
          cx="50%"
          cy="45%"
          outerRadius={80}
          label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`}
          labelLine={false}
        >
          {slices.map((entry, i) => (
            <Cell
              key={entry.nombre}
              fill={i < top.length ? colorForIndex(i) : AYUDAS_OTROS_COLOR}
            />
          ))}
        </Pie>
        <Tooltip formatter={(value: number, _name, item) => [value.toLocaleString("es-VE"), item.payload.nombre]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function PersonasPorDiaChart({ porDia }: { porDia: PorDiaEntry[] }) {
  if (porDia.every((d) => d.cantidad === 0)) return <EmptyState text="Sin entregas registradas en este rango." />;

  const data = porDia.map((d) => ({
    ...d,
    label: new Date(`${d.fecha}T12:00:00`).toLocaleDateString("es-VE", { day: "2-digit", month: "short" }),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#898781" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#898781" }} axisLine={false} tickLine={false} width={28} />
        <Tooltip
          formatter={(value: number) => [value.toLocaleString("es-VE"), "Entregas"]}
          labelFormatter={(_label, payload) => payload?.[0]?.payload?.fecha ?? ""}
          contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e5e7eb" }}
        />
        <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} fill="#2d6a2d" barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json` (from `apoyo-salupro/`)
Expected: no errors referencing `ayudas-reporte-charts.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apoyo-salupro/app/dashboard/tabs/ayudas-reporte-charts.tsx
git commit -m "feat(reportes): add ayudas report bar/pie/trend chart components"
```

---

### Task 5: Bar-chart PDF summary (replace tipo table with `drawHorizontalBarChart`)

**Files:**
- Modify: `apoyo-salupro/lib/reportes/ayudas/pdf.ts`
- Read first: `apoyo-salupro/lib/reportes/pdf-charts.ts` (already read in full during design — `drawHorizontalBarChart(doc, { x, y, width, title, items: { label, sub?, value, color: [r,g,b] }[] })` returns the next `y`).

**Interfaces:**
- Consumes: `drawHorizontalBarChart` from `@/lib/reportes/pdf-charts`, `AyudasReporteSummary` (now including `porDia`, unused here) from Task 3.
- Produces: same `buildAyudasReportePdf`/`pdfResponse` signatures as before — no change for Task callers (already wired in `app/api/reportes/ayudas/export/route.ts`).

- [ ] **Step 1: Replace `drawSummary`'s tipo table with a bar chart**

In `apoyo-salupro/lib/reportes/ayudas/pdf.ts`, add the import:

```typescript
import { drawHorizontalBarChart } from "@/lib/reportes/pdf-charts";
```

Add a hex-to-rgb helper and the palette constant right after the `PRIMARY` constant:

```typescript
const CHART_PALETTE: [number, number, number][] = [
  [42, 120, 214], // #2a78d6
  [27, 175, 122], // #1baf7a
  [237, 161, 0],  // #eda100
  [0, 131, 0],    // #008300
  [74, 58, 167],  // #4a3aa7
  [227, 73, 72],  // #e34948
  [232, 123, 164],// #e87ba4
  [235, 104, 52], // #eb6834
];
const CHART_OTROS: [number, number, number] = [137, 135, 129]; // #898781

function colorForIndex(i: number): [number, number, number] {
  return i < CHART_PALETTE.length ? CHART_PALETTE[i] : CHART_OTROS;
}
```

Replace the `if (summary.porTipo.length > 0) { ... }` block inside `drawSummary` (the `autoTable` call for "Tipo de ayuda / Cantidad total") with:

```typescript
  if (summary.porTipo.length > 0) {
    y = drawHorizontalBarChart(doc, {
      x: margin,
      y,
      width: doc.internal.pageSize.getWidth() - margin * 2,
      title: "Ayudas por tipo",
      items: summary.porTipo.map((t, i) => ({
        label: t.nombre,
        value: t.cantidad,
        color: colorForIndex(i),
      })),
    });
    y += 4;
  }
```

Remove the now-unused `autoTable` import if `buildAyudasReportePdf`'s detail table below still uses it — it does (the main `autoTable(doc, { head: [payload.headers], ... })` call stays), so **keep** the `autoTable` import; only the summary's tipo table is replaced.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json` (from `apoyo-salupro/`)
Expected: no errors referencing `lib/reportes/ayudas/pdf.ts`.

- [ ] **Step 3: Manual verification**

With `npm run dev` running and a valid session cookie:
`curl "http://localhost:3000/api/reportes/ayudas/export?format=pdf&organization_id=<org-id>&start=2026-06-21&end=2026-07-02" -H "Cookie: <cookie>" -o /tmp/ayudas.pdf`
Open the PDF: "Resumen del período" now shows horizontal colored bars per tipo (instead of a table), followed by the detail table.

- [ ] **Step 4: Commit**

```bash
git add apoyo-salupro/lib/reportes/ayudas/pdf.ts
git commit -m "feat(reportes): render ayudas-by-tipo as bar chart in PDF summary"
```

---

### Task 6: Wire charts into `AyudasReporteCard`

**Files:**
- Modify: `apoyo-salupro/app/dashboard/tabs/tab-reportes.tsx`

**Interfaces:**
- Consumes: `TiposBarChart`, `TiposPieChart`, `PersonasPorDiaChart` from Task 4 (`@/app/dashboard/tabs/ayudas-reporte-charts`).
- Produces: nothing consumed elsewhere (leaf UI change).

- [ ] **Step 1: Import charts and extend the local summary type**

At the top of `apoyo-salupro/app/dashboard/tabs/tab-reportes.tsx`, add the import:

```typescript
import { PersonasPorDiaChart, TiposBarChart, TiposPieChart } from "@/app/dashboard/tabs/ayudas-reporte-charts";
```

Update the `AyudasReporteSummary` type (added earlier in this file) to include `porDia`:

```typescript
type AyudasReporteSummary = {
  totalEntregas: number;
  totalPersonasUnicas: number;
  porTipo: { nombre: string; cantidad: number }[];
  porDia: { fecha: string; cantidad: number }[];
};
```

- [ ] **Step 2: Replace the badges block with charts**

In `AyudasReporteCard`, find this block (the current "Ayudas entregadas por tipo" badges):

```typescript
          {!loadingSummary && topTipos.length > 0 && (
            <div className="animate-[fadeIn_200ms_ease-out]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Ayudas entregadas por tipo
              </p>
              <div className="flex flex-wrap gap-1.5">
                {topTipos.map((t) => (
                  <span
                    key={t.nombre}
                    className="inline-block text-[11px] font-semibold bg-primary-light text-primary-dark rounded-full px-2.5 py-1 whitespace-nowrap"
                  >
                    {t.cantidad}× {t.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}
```

Replace it with:

```typescript
          {!loadingSummary && summary && summary.totalEntregas > 0 && (
            <div className="space-y-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Personas atendidas por día
                </p>
                <PersonasPorDiaChart porDia={summary.porDia} />
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Ayudas entregadas por tipo
                  </p>
                  <TiposBarChart porTipo={summary.porTipo} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Distribución por tipo
                  </p>
                  <TiposPieChart porTipo={summary.porTipo} />
                </div>
              </div>
            </div>
          )}
```

- [ ] **Step 3: Remove the now-unused `topTipos` variable**

Find and delete this line inside `AyudasReporteCard` (no longer referenced after Step 2):

```typescript
  const topTipos = summary?.porTipo.slice(0, 6) ?? [];
```

- [ ] **Step 4: Typecheck, lint, build**

Run: `npx tsc --noEmit -p tsconfig.json` (from `apoyo-salupro/`)
Expected: no errors referencing `tab-reportes.tsx` or `ayudas-reporte-charts.tsx`.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual browser verification**

With `npm run dev` running, open Reportes tab → "Reporte de Ayudas": below the stat tiles, see the daily-trend bar chart, then side-by-side bar chart (all tipos, colored, scrollable if many) and pie chart (top 8 + "Otros" if applicable) with legend and hover tooltips. Changing the date range refetches and re-renders all three.

- [ ] **Step 6: Commit**

```bash
git add apoyo-salupro/app/dashboard/tabs/tab-reportes.tsx
git commit -m "feat(reportes): wire bar/pie/trend charts into ayudas report card"
```

---

## Self-Review Notes

- **Spec coverage:** Part A (filtered total + page/page_size pagination with page numbers, Tasks 1-2), Part B (porDia backend, Task 3; three charts with fixed 8-color palette + "Otros" fold, Task 4; PDF bar chart via existing helper, Task 5; card wiring replacing the capped badge list, Task 6) — all covered.
- **No test framework:** verification steps use `tsc --noEmit`, `npm run build`, `curl`, and manual browser checks, consistent with the rest of `lib/reportes/`.
- **Type consistency:** `AyudasReporteSummary` (with `porDia`) is defined once in `lib/reportes/ayudas/export-data.ts` (Task 3) and mirrored exactly (same field names/types) in `tab-reportes.tsx` (Task 6, pre-existing local type per the original plan's pattern) and consumed structurally by the chart props in `ayudas-reporte-charts.tsx` (Task 4, which takes `porTipo`/`porDia` directly rather than the whole summary object, so no duplicate type import is required).
- **Breaking-change check:** Task 1 removes `cursor`/`limit` support from `GET /api/catastrophe/ayudas` — confirmed via repo search that `tab-ayudas.tsx` is the only caller, so this is safe.
