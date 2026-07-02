# Reporte de Ayudas Humanitarias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Reporte de Ayudas" card to `TabReportes`, below "Ingresos por día", showing an aggregated summary (personas atendidas + totales por tipo de ayuda) for a chosen date range, with CSV/PDF export (PDF includes SaluPro logo + summary block).

**Architecture:** Mirrors the existing `ingresos-hoy` report vertical slice (date-bounds helper → payload builder querying Supabase → jsPDF/autoTable PDF builder → two `GET` route handlers → a card component in `tab-reportes.tsx`), but keyed on a date **range** instead of a single day, and with an added `summary` endpoint for the on-screen aggregate.

**Tech Stack:** Next.js route handlers, Supabase service client, jsPDF + jspdf-autotable, React (client component), existing `StatCard`/toast/`getClientOrganizationId` utilities already in the codebase.

## Global Constraints

- No test framework exists in this repo (no `jest`/`vitest`, no `*.test.*` files, `package.json` has no `test` script) — verification steps use `npm run build`, `npm run lint`, and manual `curl`/browser checks instead of automated tests.
- Dates are always in `YYYY-MM-DD` form and interpreted in `America/Caracas` (VET, UTC-4), matching `lib/reportes/ingresos-hoy/date-bounds.ts`.
- All new endpoints call `requireReportAuth()` first and use `createServiceClient()` from `@/lib/supabase/server`, matching every other file under `app/api/reportes/`.
- CSV output goes through `csvResponse`/`rowsToCsv` from `@/lib/reportes/csv.ts`; PDF output goes through a `pdfResponse` helper (same shape as `lib/reportes/ingresos-hoy/pdf.ts:82-90`).
- PDF header must use `getSaluProLogoDataUrl()` from `@/lib/reportes/pdf-logo.ts`, same as `lib/reportes/ingresos-hoy/pdf.ts:13-49`.
- Frontend card styling: apply `design-taste-frontend` and `emil-design-eng` skill conventions (generous spacing, clear type hierarchy, restrained motion) while staying visually consistent with the existing `IngresosPorFechaCard`/`StatCard` in `tab-reportes.tsx`.

---

### Task 1: Date-range bounds helper

**Files:**
- Create: `apoyo-salupro/lib/reportes/ayudas/date-bounds.ts`

**Interfaces:**
- Consumes: nothing new (pure function).
- Produces: `getAyudasRangeUtcBounds(startVet: string, endVet: string): { startUtc: string; endUtc: string }` — used by Task 2.

- [ ] **Step 1: Write the helper**

```typescript
// apoyo-salupro/lib/reportes/ayudas/date-bounds.ts

/**
 * Ventana UTC para un rango de fechas en Venezuela (UTC-4): medianoche VET = 04:00 UTC.
 * `startVet`/`endVet` son "YYYY-MM-DD", inclusive en ambos extremos.
 */
export function getAyudasRangeUtcBounds(
  startVet: string,
  endVet: string,
): { startUtc: string; endUtc: string } {
  const [ey, em, ed] = endVet.split("-").map(Number);
  const endExclusiveVet = new Date(Date.UTC(ey, em - 1, ed + 1)).toISOString().slice(0, 10);

  return {
    startUtc: `${startVet} 04:00:00`,
    endUtc: `${endExclusiveVet} 04:00:00`,
  };
}
```

- [ ] **Step 2: Verify manually**

Run: `node -e "console.log(require('./apoyo-salupro/.next/server/... '))"` is not viable pre-build (TS). Instead, sanity-check by reasoning + a scratch ts-node-free check:

Run (from `apoyo-salupro/`): `node -e "
const { execSync } = require('child_process');
"` — skip; TypeScript-only helper, verified via Task 2's route being exercised with `curl` in Task 3's manual test. No standalone runtime check needed since there's no test runner in this repo.

- [ ] **Step 3: Commit**

```bash
git add apoyo-salupro/lib/reportes/ayudas/date-bounds.ts
git commit -m "feat(reportes): add date-range bounds helper for ayudas report"
```

---

### Task 2: Payload builder (query + CSV rows + summary)

**Files:**
- Create: `apoyo-salupro/lib/reportes/ayudas/export-data.ts`
- Read first: `apoyo-salupro/lib/reportes/ingresos-hoy/export-data.ts` (pagination pattern), `apoyo-salupro/app/api/catastrophe/ayudas/route.ts:35-45` (table/join shape), `apoyo-salupro/lib/types/database.ts:742-830` (`ayuda_tipos`, `ayuda_entregas`, `ayuda_entrega_items` row shapes; also exported types `AyudaTipoCatalogo`, `AyudaEntrega`, `AyudaEntregaItem` at lines 1053-1057).

**Interfaces:**
- Consumes: `getAyudasRangeUtcBounds` from Task 1.
- Produces:
  ```typescript
  export type AyudasReporteSummary = {
    totalEntregas: number;
    totalPersonasUnicas: number;
    porTipo: { nombre: string; cantidad: number }[]; // desc by cantidad
  };

  export type AyudasReportePayload = {
    title: string;
    subtitle: string;
    filenameBase: string;
    headers: string[];
    rows: unknown[][];
    summary: AyudasReporteSummary;
  };

  export async function buildAyudasReportePayload(
    organizationId: string,
    supabase: SupabaseClient<Database>,
    startVet: string,
    endVet: string,
  ): Promise<AyudasReportePayload>
  ```
  Used by Task 3 (summary route), Task 4 (export route), Task 5 (PDF builder).

- [ ] **Step 1: Write the payload builder**

```typescript
// apoyo-salupro/lib/reportes/ayudas/export-data.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { getAyudasRangeUtcBounds } from "@/lib/reportes/ayudas/date-bounds";

export type AyudasReporteSummary = {
  totalEntregas: number;
  totalPersonasUnicas: number;
  porTipo: { nombre: string; cantidad: number }[];
};

export type AyudasReportePayload = {
  title: string;
  subtitle: string;
  filenameBase: string;
  headers: string[];
  rows: unknown[][];
  summary: AyudasReporteSummary;
};

type ItemRow = {
  cantidad: number;
  ayuda_tipos: { id: string; nombre: string } | { id: string; nombre: string }[] | null;
};

type EntregaRow = {
  id: string;
  cedula: string;
  nombre_completo: string;
  created_at: string;
  ayuda_entrega_items: ItemRow[];
};

function tipoNombre(t: ItemRow["ayuda_tipos"]): string {
  if (!t) return "—";
  const one = Array.isArray(t) ? t[0] : t;
  return one?.nombre ?? "—";
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-VE", { timeZone: "America/Caracas" });
}

const HEADERS = ["Cédula", "Nombre completo", "Ayudas entregadas", "Fecha/hora"];

export async function buildAyudasReportePayload(
  organizationId: string,
  supabase: SupabaseClient<Database>,
  startVet: string,
  endVet: string,
): Promise<AyudasReportePayload> {
  const { startUtc, endUtc } = getAyudasRangeUtcBounds(startVet, endVet);

  const data: EntregaRow[] = [];
  const PAGE = 500;
  for (let from = 0; ; from += PAGE) {
    const page = await supabase
      .from("ayuda_entregas")
      .select("id, cedula, nombre_completo, created_at, ayuda_entrega_items(cantidad, ayuda_tipos(id, nombre))")
      .eq("organization_id", organizationId)
      .gte("created_at", startUtc)
      .lt("created_at", endUtc)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (page.error) throw new Error(page.error.message);
    if (!page.data || page.data.length === 0) break;
    data.push(...(page.data as unknown as EntregaRow[]));
    if (page.data.length < PAGE) break;
  }

  const rows = data.map((entrega) => [
    entrega.cedula,
    entrega.nombre_completo,
    entrega.ayuda_entrega_items
      .map((it) => `${it.cantidad}× ${tipoNombre(it.ayuda_tipos)}`)
      .join(" · "),
    fmtFecha(entrega.created_at),
  ]);

  const porTipoMap = new Map<string, number>();
  const cedulasUnicas = new Set<string>();
  for (const entrega of data) {
    cedulasUnicas.add(entrega.cedula);
    for (const it of entrega.ayuda_entrega_items) {
      const nombre = tipoNombre(it.ayuda_tipos);
      porTipoMap.set(nombre, (porTipoMap.get(nombre) ?? 0) + it.cantidad);
    }
  }
  const porTipo = [...porTipoMap.entries()]
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

  const rangoLabel = startVet === endVet ? startVet : `${startVet} a ${endVet}`;

  return {
    title: `Reporte de Ayudas — ${rangoLabel} — Apoyo SaluPro`,
    subtitle: `${rangoLabel} · ${data.length} entrega(s)`,
    filenameBase: `ayudas-${startVet}_${endVet}`,
    headers: HEADERS,
    rows,
    summary: {
      totalEntregas: data.length,
      totalPersonasUnicas: cedulasUnicas.size,
      porTipo,
    },
  };
}
```

- [ ] **Step 2: Verify it typechecks**

Run (from `apoyo-salupro/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no errors referencing `lib/reportes/ayudas/export-data.ts`.

- [ ] **Step 3: Commit**

```bash
git add apoyo-salupro/lib/reportes/ayudas/export-data.ts
git commit -m "feat(reportes): add ayudas report payload builder with range + summary"
```

---

### Task 3: Summary route (`GET /api/reportes/ayudas/summary`)

**Files:**
- Create: `apoyo-salupro/app/api/reportes/ayudas/summary/route.ts`
- Read first: `apoyo-salupro/app/api/reportes/ingresos-hoy/export/route.ts` (auth + param validation pattern).

**Interfaces:**
- Consumes: `buildAyudasReportePayload` from Task 2 (`.summary` field only).
- Produces: JSON response `{ summary: AyudasReporteSummary } | { error: string }` — consumed by Task 6 (frontend card).

- [ ] **Step 1: Write the route**

```typescript
// apoyo-salupro/app/api/reportes/ayudas/summary/route.ts
import type { NextRequest } from "next/server";
import { getOrganizationId } from "@/lib/config";
import { buildAyudasReportePayload } from "@/lib/reportes/ayudas/export-data";
import { requireReportAuth } from "@/lib/reportes/require-auth";
import { createServiceClient } from "@/lib/supabase/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/reportes/ayudas/summary?organization_id=&start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Resumen agregado (total entregas, personas únicas, cantidad por tipo) para
 * el rango de fechas indicado (hora Venezuela).
 */
export async function GET(request: NextRequest) {
  const authError = await requireReportAuth();
  if (authError) return authError;

  const { searchParams } = request.nextUrl;
  const organization_id = searchParams.get("organization_id") ?? getOrganizationId();
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !DATE_RE.test(start) || !end || !DATE_RE.test(end)) {
    return Response.json({ error: "start/end requeridos en formato YYYY-MM-DD" }, { status: 400 });
  }
  if (start > end) {
    return Response.json({ error: "start no puede ser posterior a end" }, { status: 400 });
  }

  try {
    const supabase = await createServiceClient();
    const payload = await buildAyudasReportePayload(organization_id, supabase, start, end);
    return Response.json({ summary: payload.summary, error: null });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Error al cargar el resumen" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Run dev server and verify manually**

Run (from `apoyo-salupro/`): `npm run dev` (leave running), then in another shell:
`curl "http://localhost:3000/api/reportes/ayudas/summary?organization_id=<real-org-id>&start=2026-06-21&end=2026-07-02" -H "Cookie: <session-cookie-from-browser>"`
Expected: `401` without cookie (auth required); with a valid session cookie from the logged-in browser, `200` with `{ "summary": { "totalEntregas": ..., "totalPersonasUnicas": ..., "porTipo": [...] }, "error": null }`.

- [ ] **Step 3: Commit**

```bash
git add apoyo-salupro/app/api/reportes/ayudas/summary/route.ts
git commit -m "feat(reportes): add ayudas summary endpoint"
```

---

### Task 4: PDF builder

**Files:**
- Create: `apoyo-salupro/lib/reportes/ayudas/pdf.ts`
- Read first: `apoyo-salupro/lib/reportes/ingresos-hoy/pdf.ts` in full (header/logo drawing, autoTable config, `pdfResponse`).

**Interfaces:**
- Consumes: `AyudasReportePayload` type from Task 2.
- Produces: `buildAyudasReportePdf(payload: AyudasReportePayload): Buffer` and `pdfResponse(body: Buffer, filename: string): Response` — used by Task 5 (export route).

- [ ] **Step 1: Write the PDF builder**

```typescript
// apoyo-salupro/lib/reportes/ayudas/pdf.ts
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { AyudasReportePayload } from "@/lib/reportes/ayudas/export-data";
import { getSaluProLogoDataUrl } from "@/lib/reportes/pdf-logo";

const PRIMARY: [number, number, number] = [45, 106, 45];

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function drawPdfHeader(doc: jsPDF, title: string, subtitle?: string): number {
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();

  try {
    doc.addImage(getSaluProLogoDataUrl(), "PNG", margin, 10, 42, 12);
  } catch {
    doc.setFontSize(12);
    doc.setTextColor(...PRIMARY);
    doc.text("Apoyo SaluPro", margin, 18);
  }

  doc.setFontSize(13);
  doc.setTextColor(...PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageW - margin, 16, { align: "right", maxWidth: pageW - margin * 2 - 45 });
  doc.setFont("helvetica", "normal");

  let y = 28;
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, margin, y);
    y += 5;
  }

  const generatedAt = new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" });
  doc.setFontSize(8);
  doc.text(`Generado: ${generatedAt} VET`, margin, y);
  y += 6;

  doc.setDrawColor(229, 231, 235);
  doc.line(margin, y, pageW - margin, y);
  return y + 6;
}

function drawSummary(doc: jsPDF, summary: AyudasReportePayload["summary"], startY: number): number {
  const margin = 14;
  let y = startY;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY);
  doc.text("Resumen del período", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Total entregas: ${summary.totalEntregas}`, margin, y);
  doc.text(`Personas únicas atendidas: ${summary.totalPersonasUnicas}`, margin + 80, y);
  y += 8;

  if (summary.porTipo.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Tipo de ayuda", "Cantidad total"]],
      body: summary.porTipo.map((t) => [t.nombre, String(t.cantidad)]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: margin, right: margin },
      tableWidth: 90,
    });
    // @ts-expect-error jspdf-autotable augments doc at runtime with lastAutoTable
    y = doc.lastAutoTable.finalY + 8;
  }

  return y;
}

export function buildAyudasReportePdf(payload: AyudasReportePayload): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const margin = 14;
  let y = drawPdfHeader(doc, payload.title, payload.subtitle);
  y = drawSummary(doc, payload.summary, y);

  autoTable(doc, {
    startY: y,
    head: [payload.headers],
    body: payload.rows.map((row) => row.map(cell)),
    styles: { fontSize: 8, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: margin, right: margin },
  });

  return Buffer.from(doc.output("arraybuffer"));
}

export function pdfResponse(body: Buffer, filename: string): Response {
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
```

- [ ] **Step 2: Verify it typechecks**

Run (from `apoyo-salupro/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no errors referencing `lib/reportes/ayudas/pdf.ts`.

- [ ] **Step 3: Commit**

```bash
git add apoyo-salupro/lib/reportes/ayudas/pdf.ts
git commit -m "feat(reportes): add ayudas report PDF builder with summary block"
```

---

### Task 5: Export route (`GET /api/reportes/ayudas/export`)

**Files:**
- Create: `apoyo-salupro/app/api/reportes/ayudas/export/route.ts`
- Read first: `apoyo-salupro/app/api/reportes/ingresos-hoy/export/route.ts` (exact pattern to mirror).

**Interfaces:**
- Consumes: `buildAyudasReportePayload` (Task 2), `buildAyudasReportePdf`/`pdfResponse` (Task 4), `csvResponse`/`rowsToCsv` (existing `@/lib/reportes/csv.ts`).
- Produces: CSV or PDF file download — consumed by Task 6 (frontend card's "Generar" button).

- [ ] **Step 1: Write the route**

```typescript
// apoyo-salupro/app/api/reportes/ayudas/export/route.ts
import type { NextRequest } from "next/server";
import { getOrganizationId } from "@/lib/config";
import { csvResponse, rowsToCsv } from "@/lib/reportes/csv";
import { buildAyudasReportePayload } from "@/lib/reportes/ayudas/export-data";
import { buildAyudasReportePdf, pdfResponse } from "@/lib/reportes/ayudas/pdf";
import { requireReportAuth } from "@/lib/reportes/require-auth";
import { createServiceClient } from "@/lib/supabase/server";

const EXPORT_FORMATS = new Set(["csv", "pdf"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/reportes/ayudas/export?format=csv|pdf&organization_id=&start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Descarga el detalle de ayudas entregadas en el rango de fechas (hora Venezuela).
 */
export async function GET(request: NextRequest) {
  const authError = await requireReportAuth();
  if (authError) return authError;

  const { searchParams } = request.nextUrl;
  const format = searchParams.get("format") ?? "csv";
  const organization_id = searchParams.get("organization_id") ?? getOrganizationId();
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!EXPORT_FORMATS.has(format)) {
    return Response.json({ error: "format inválido. Use: csv o pdf" }, { status: 400 });
  }
  if (!start || !DATE_RE.test(start) || !end || !DATE_RE.test(end)) {
    return Response.json({ error: "start/end requeridos en formato YYYY-MM-DD" }, { status: 400 });
  }
  if (start > end) {
    return Response.json({ error: "start no puede ser posterior a end" }, { status: 400 });
  }

  try {
    const supabase = await createServiceClient();
    const payload = await buildAyudasReportePayload(organization_id, supabase, start, end);
    const filename = `${payload.filenameBase}.${format}`;

    if (format === "pdf") {
      const pdf = buildAyudasReportePdf(payload);
      return pdfResponse(pdf, filename);
    }

    return csvResponse(rowsToCsv(payload.headers, payload.rows), filename);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Error al exportar" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify manually**

With `npm run dev` running (from Task 3) and a valid session cookie:
`curl "http://localhost:3000/api/reportes/ayudas/export?format=csv&organization_id=<real-org-id>&start=2026-06-21&end=2026-07-02" -H "Cookie: <cookie>" -o /tmp/ayudas.csv`
Expected: `200`, file downloads, opens as CSV with header row `Cédula,Nombre completo,Ayudas entregadas,Fecha/hora`.
Repeat with `format=pdf -o /tmp/ayudas.pdf`, open the PDF and confirm: logo top-left, title top-right, "Resumen del período" block with totals + tipo table, then detail table.

- [ ] **Step 3: Commit**

```bash
git add apoyo-salupro/app/api/reportes/ayudas/export/route.ts
git commit -m "feat(reportes): add ayudas report export endpoint (csv/pdf)"
```

---

### Task 6: `AyudasReporteCard` frontend component

**Files:**
- Modify: `apoyo-salupro/app/dashboard/tabs/tab-reportes.tsx`
- Read first: apply `design-taste-frontend` and `emil-design-eng` skills before writing JSX/CSS for this card (per Global Constraints).

**Interfaces:**
- Consumes: `GET /api/reportes/ayudas/summary` (Task 3), `GET /api/reportes/ayudas/export` (Task 5), existing `StatCard` component (`tab-reportes.tsx:23-53`), existing `ExportFormat` type (`tab-reportes.tsx:19`), `getClientOrganizationId` (`@/lib/config`), `useToast` (`@/components/toast-provider`), `todayVet()` (`tab-reportes.tsx:108-110`).
- Produces: `AyudasReporteCard` component, rendered inside `TabReportes` right after `<IngresosPorFechaCard .../>` (currently the last element before `</div>` at `tab-reportes.tsx:611`).

- [ ] **Step 1: Add the `AyudasReporteSummary` type and default range near the top of the file**

Insert after the existing type aliases at `tab-reportes.tsx:20-21` (right after `type IngresosHoyExportKey = ...`):

```typescript
type AyudasExportKey = `ayudas-reporte:${ExportFormat}`;

type AyudasReporteSummary = {
  totalEntregas: number;
  totalPersonasUnicas: number;
  porTipo: { nombre: string; cantidad: number }[];
};

function defaultRangeStart(maxDate: string): string {
  const [y, m, d] = maxDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 6)).toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Add the `AyudasReporteCard` component**

Insert right after the `IngresosPorFechaCard` function closes (after `tab-reportes.tsx:208`, before `function ExportCard(...)`):

```typescript
function AyudasReporteCard({
  onGenerar,
  generating,
}: {
  onGenerar: (start: string, end: string, format: ExportFormat) => void;
  generating: boolean;
}) {
  const toast = useToast();
  const max = todayVet();
  const [start, setStart] = useState(defaultRangeStart(max));
  const [end, setEnd] = useState(max);
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [summary, setSummary] = useState<AyudasReporteSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    if (!start || !end || start > end) return;
    let cancelled = false;
    setLoadingSummary(true);
    const orgId = getClientOrganizationId();
    fetch(`/api/reportes/ayudas/summary?organization_id=${orgId}&start=${start}&end=${end}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) throw new Error(json.error);
        setSummary(json.summary);
      })
      .catch(() => {
        if (!cancelled) toast.error("No se pudo cargar el resumen de ayudas");
      })
      .finally(() => {
        if (!cancelled) setLoadingSummary(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  const rangeInvalid = Boolean(start && end && start > end);
  const topTipos = summary?.porTipo.slice(0, 6) ?? [];

  return (
    <div className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-[0_20px_40px_-28px_rgba(0,0,0,0.18)] space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="flex items-center gap-3 lg:flex-1 lg:min-w-0">
          <div className="shrink-0 w-10 h-10 rounded-full bg-primary-light flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-primary">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21l7.78-7.55 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">Reporte de Ayudas</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Personas atendidas y ayudas entregadas en el rango que elijas (hora Venezuela)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 shrink-0">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              Desde
            </span>
            <input
              type="date"
              value={start}
              max={end || max}
              onChange={(e) => setStart(e.target.value)}
              className="text-sm rounded-lg border border-border px-3 py-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary/40"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              Hasta
            </span>
            <input
              type="date"
              value={end}
              min={start}
              max={max}
              onChange={(e) => setEnd(e.target.value)}
              className="text-sm rounded-lg border border-border px-3 py-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary/40"
            />
          </label>

          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              Formato
            </span>
            <div className="relative inline-flex bg-muted rounded-lg p-1 text-xs font-semibold">
              <span
                aria-hidden
                className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-md bg-white shadow-sm transition-transform duration-200 ease-out"
                style={{ transform: format === "pdf" ? "translateX(100%)" : "translateX(0)" }}
              />
              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`relative z-10 px-4 py-1.5 rounded-md transition-colors duration-150 ${
                  format === "csv" ? "text-primary" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => setFormat("pdf")}
                className={`relative z-10 px-4 py-1.5 rounded-md transition-colors duration-150 ${
                  format === "pdf" ? "text-primary" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                PDF
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onGenerar(start, end, format)}
            disabled={!start || !end || rangeInvalid || generating}
            className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-primary rounded-lg px-5 py-2.5 shadow-sm shadow-primary/20 transition-[transform,background-color] duration-150 ease-out hover:bg-primary-dark active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
          >
            {generating ? (
              <>
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 animate-spin">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.3" />
                  <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                Generando…
              </>
            ) : (
              "Generar"
            )}
          </button>
        </div>
      </div>

      {rangeInvalid && (
        <p className="text-xs text-crisis font-medium">La fecha "Desde" no puede ser posterior a "Hasta".</p>
      )}

      {!rangeInvalid && (
        <div className="pt-4 border-t border-border space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl">
            <StatCard
              loading={loadingSummary}
              value={summary?.totalEntregas ?? 0}
              label="Entregas registradas"
              color="text-primary"
              ring="border-primary/25"
            />
            <StatCard
              loading={loadingSummary}
              value={summary?.totalPersonasUnicas ?? 0}
              label="Personas atendidas"
              sub="Cédulas únicas en el rango"
              color="text-gray-900"
              ring="border-border"
            />
          </div>

          {!loadingSummary && topTipos.length > 0 && (
            <div>
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

          {!loadingSummary && summary && summary.totalEntregas === 0 && (
            <p className="text-xs text-gray-400">Sin ayudas registradas en este rango.</p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire the export handler and export key into `TabReportes`**

In `TabReportes`, change the `exporting` state type at `tab-reportes.tsx:258`:

```typescript
  const [exporting, setExporting] = useState<ExportKey | IngresosHoyExportKey | AyudasExportKey | null>(null);
```

Add a new handler right after `downloadIngresosHoy` closes (after `tab-reportes.tsx:305`, before `const download = ...`):

```typescript
  const downloadAyudasReporte = async (start: string, end: string, format: ExportFormat) => {
    const key: AyudasExportKey = `ayudas-reporte:${format}`;
    setExporting(key);
    try {
      const res = await fetch(
        `/api/reportes/ayudas/export?format=${format}&start=${start}&end=${end}&organization_id=${orgId}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Error al exportar");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `ayudas-reporte.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Descarga iniciada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al exportar");
    } finally {
      setExporting(null);
    }
  };
```

- [ ] **Step 4: Render the card below "Ingresos por día"**

Replace the closing of the component at `tab-reportes.tsx:607-613`:

```typescript
      {/* Ingresos por día */}
      <IngresosPorFechaCard
        onGenerar={downloadIngresosHoy}
        generating={exporting === "ingresos-hoy:csv" || exporting === "ingresos-hoy:pdf"}
      />
    </div>
  );
}
```

with:

```typescript
      {/* Ingresos por día */}
      <IngresosPorFechaCard
        onGenerar={downloadIngresosHoy}
        generating={exporting === "ingresos-hoy:csv" || exporting === "ingresos-hoy:pdf"}
      />

      {/* Reporte de Ayudas */}
      <AyudasReporteCard
        onGenerar={downloadAyudasReporte}
        generating={exporting === "ayudas-reporte:csv" || exporting === "ayudas-reporte:pdf"}
      />
    </div>
  );
}
```

- [ ] **Step 5: Build and lint**

Run (from `apoyo-salupro/`): `npm run lint`
Expected: no new errors in `app/dashboard/tabs/tab-reportes.tsx`.

Run: `npm run build`
Expected: build succeeds (confirms JSX/types compile end-to-end).

- [ ] **Step 6: Manual browser verification**

With `npm run dev` running, log in, open the Reportes tab, scroll to "Reporte de Ayudas" below "Ingresos por día":
- Default range shows last 7 days; changing Desde/Hasta refetches the summary tiles and badges.
- Setting Desde after Hasta shows the inline error and disables "Generar".
- "Generar" with CSV downloads a file openable in a spreadsheet with the right rows.
- "Generar" with PDF downloads a file with logo, title, resumen block, and detail table matching the on-screen summary.

- [ ] **Step 7: Commit**

```bash
git add apoyo-salupro/app/dashboard/tabs/tab-reportes.tsx
git commit -m "feat(reportes): add ayudas report card with date-range filter and export"
```

---

## Self-Review Notes

- **Spec coverage:** date-range filter (Task 6), on-screen aggregate summary scoped to range (Task 3 + Task 6), CSV/PDF export (Task 5), PDF logo + summary block (Task 4), placement below "Ingresos por día" (Task 6 Step 4) — all covered.
- **No test framework in repo:** verification steps use `tsc --noEmit`, `npm run lint`, `npm run build`, and manual `curl`/browser checks instead of unit tests, consistent with every other file under `lib/reportes/` (none have `*.test.*` siblings).
- **Type consistency:** `AyudasReportePayload`/`AyudasReporteSummary` defined once in Task 2, reused verbatim (same field names: `totalEntregas`, `totalPersonasUnicas`, `porTipo`) in Task 3, Task 4, and Task 6.
