# Paginación de Ayudas Entregadas + Gráficos del Reporte — Diseño

## Contexto

Sobre la base ya construida (`docs/superpowers/specs/2026-07-02-reporte-ayudas-design.md`, plan `docs/superpowers/plans/2026-07-02-reporte-ayudas.md`), se piden dos mejoras:

1. En `TabAyudas` → subvista "Ayudas entregadas" (`apoyo-salupro/app/dashboard/tabs/tab-ayudas.tsx`), la tabla actual trae hasta 50 filas fijas sin paginación real. Se necesita un total visible (respetando filtros) y paginación por número de página con tamaño configurable.
2. En `TabReportes` → card "Reporte de Ayudas" (`apoyo-salupro/app/dashboard/tabs/tab-reportes.tsx`, componente `AyudasReporteCard`), además de los stat tiles y badges actuales, se piden gráficos (barra, pastel, tendencia) pensados para stakeholders, y que el listado de tipos de ayuda no esté limitado a un top fijo (el catálogo de tipos puede crecer). El PDF exportable también debe incorporar un gráfico de barras (reutilizando el helper `drawHorizontalBarChart` ya existente en `lib/reportes/pdf-charts.ts`, usado en otros PDFs del proyecto).

Librería de gráficos: `recharts` (ya está en `package.json`, sin uso previo en el proyecto). Paleta y reglas de accesibilidad siguen la skill `dataviz` del proyecto: paleta categórica fija de 8 tonos (nunca generada/ciclada), gráficos de una sola serie sin leyenda (el título basta), leyenda + tooltip para los de identidad múltiple (el pastel), agrupar en "Otros" más allá del top 8.

## Parte A — Paginación de "Ayudas entregadas"

### Backend: `apoyo-salupro/app/api/catastrophe/ayudas/route.ts`

El `GET` actual usa `limit`/`cursor` (cursor-based, sin total). Se reemplaza por paginación por página:

- Query params: `organization_id` (requerido), `cedula`, `nombre`, `tipo_id` (filtros existentes, sin cambios), `page` (default `1`, mínimo 1), `page_size` (default `12`, uno de `12|25|50|100|500`; cualquier otro valor cae a `12`).
- La query a Supabase pasa de `.limit(limit)` a `.select(..., { count: "exact" })` + `.range(from, to)` donde `from = (page - 1) * page_size` y `to = from + page_size - 1`. El `count: "exact"` cuenta todas las filas que matchean los filtros (sin el `range`), respetando `cedula`/`nombre`/`tipo_id`.
- Se elimina el parámetro `cursor` y el cálculo de `next_cursor`/`has_more` (sin otros consumidores en el repo — confirmado por búsqueda de `/api/catastrophe/ayudas` fuera de `tab-ayudas.tsx` y el propio route).
- Respuesta: `{ data, total, page, page_size, error }`.

### Frontend: `apoyo-salupro/app/dashboard/tabs/tab-ayudas.tsx`

En la subvista `entregadas`:
- Nuevo estado: `page` (default `1`), `pageSize` (default `12`), `total` (default `0`).
- `loadRows` pasa `page` y `page_size` en vez de `limit` fijo, y guarda `total` de la respuesta.
- Cambiar `searchCedula`, `searchNombre`, `filterTipoId` o `pageSize` reinicia `page` a `1` (mismo `useEffect` de debounce ya existente, se agrega el reset).
- Arriba de la tabla, junto al encabezado "AYUDAS ENTREGADAS": texto chiquito `"{total} persona(s) ayudada(s)"` (respeta filtros activos, ya viene filtrado del backend).
- Debajo de la tabla: control de paginación —
  - Selector de tamaño de página: `12 / 25 / 50 / 100 / 500`.
  - Números de página + flechas prev/next. Con `total` y `pageSize` se calcula `totalPages = Math.max(1, Math.ceil(total / pageSize))`. Para no listar cientos de números con `page_size=12` y muchos registros, se muestra un rango acotado (página actual ± 2, más primera/última con elipsis) — patrón común, sin librería nueva.
  - Deshabilitar prev en página 1, next en última página.

## Parte B — Gráficos del Reporte de Ayudas

### Backend: `apoyo-salupro/lib/reportes/ayudas/export-data.ts`

`AyudasReporteSummary` gana un campo:

```typescript
export type AyudasReporteSummary = {
  totalEntregas: number;
  totalPersonasUnicas: number;
  porTipo: { nombre: string; cantidad: number }[]; // ya existe, sin capar — se mantiene
  porDia: { fecha: string; cantidad: number }[];    // nuevo: entregas por día VET, orden ascendente
};
```

`porDia` se calcula agrupando `entrega.created_at` por fecha VET (`toLocaleDateString`/`Intl.DateTimeFormat` con `timeZone: "America/Caracas"`, formato `YYYY-MM-DD`) y contando entregas (no personas únicas) por día, incluyendo los días del rango sin entregas como `cantidad: 0` para que la barra de tendencia no tenga huecos.

`GET /api/reportes/ayudas/summary` no cambia de forma (sigue devolviendo `payload.summary`), pero ahora incluye `porDia`.

### Frontend: nuevo archivo `apoyo-salupro/app/dashboard/tabs/ayudas-reporte-charts.tsx`

Componente cliente aislado (`"use client"`) que recibe `summary: AyudasReporteSummary` y renderiza tres gráficos con `recharts`:

1. **`TiposBarChart`** — `BarChart` horizontal (`layout="vertical"`), una barra por tipo de ayuda en `summary.porTipo` (todos, sin capar), ordenados desc por cantidad. Colores: paleta categórica fija de 8 tonos ciclada por posición hasta 8, y gris neutro para el resto (posición 9+) — igual criterio que el pastel (ver abajo) para que compartan identidad visual. Contenedor con `max-height` + `overflow-y-auto` cuando hay más de ~10 tipos (la altura del `BarChart` crece con la cantidad de barras, así que se fija un contenedor scrollable en vez de comprimir las barras). Tooltip con nombre + cantidad exacta.
2. **`TiposPieChart`** — `PieChart` con las primeras 8 entradas de `summary.porTipo` (incluyendo su color de paleta) más una porción `"Otros"` (gris) sumando el resto si `porTipo.length > 8`. Leyenda visible (Recharts `<Legend />`), tooltip con nombre + cantidad + porcentaje.
3. **`PersonasPorDiaChart`** — `BarChart` vertical estándar, eje X = `summary.porDia[].fecha` (formateado corto, ej. `02 jul`), eje Y = cantidad, una sola serie en el verde primario de SaluPro (`--color-primary` / `#2d6a2d`), sin leyenda (el título del bloque ya lo indica). Tooltip con fecha completa + cantidad.

Paleta categórica (8 tonos, orden fijo, mismo orden en barra y pastel):
```typescript
export const AYUDAS_CATEGORICAL_PALETTE = [
  "#2a78d6", // azul
  "#1baf7a", // aqua
  "#eda100", // amarillo
  "#008300", // verde
  "#4a3aa7", // violeta
  "#e34948", // rojo
  "#e87ba4", // magenta
  "#eb6834", // naranja
] as const;
export const AYUDAS_OTROS_COLOR = "#898781"; // gris neutro (muted ink)
```
(Paleta validada CVD-safe, tomada de la skill `dataviz` del proyecto — no se cicla más allá de 8, el resto entra a "Otros".)

Cada gráfico maneja su propio estado vacío (`summary.porTipo.length === 0` / `summary.porDia.every(d => d.cantidad === 0)`): texto simple "Sin datos en este rango", sin renderizar el chart vacío.

### Integración en `AyudasReporteCard` (`apoyo-salupro/app/dashboard/tabs/tab-reportes.tsx`)

- Se elimina el bloque actual de badges "Ayudas entregadas por tipo" (limitado a 6) — lo reemplaza `TiposBarChart` (que ya muestra todos).
- Debajo de los 2 stat tiles existentes (Entregas registradas / Personas atendidas), en este orden: `PersonasPorDiaChart`, luego `TiposBarChart` y `TiposPieChart` lado a lado en `grid sm:grid-cols-2` (apilados en mobile).
- El `useEffect` que hace fetch a `/api/reportes/ayudas/summary` no cambia de forma, solo el tipo `AyudasReporteSummary` se actualiza (import compartido con el nuevo archivo de charts o redefinido igual — se centraliza el tipo en `ayudas-reporte-charts.tsx` y se importa en `tab-reportes.tsx` para no duplicarlo).

## PDF: `apoyo-salupro/lib/reportes/ayudas/pdf.ts`

En `drawSummary`, se reemplaza la tabla `autoTable` de "Tipo de ayuda → Cantidad total" por `drawHorizontalBarChart` (de `lib/reportes/pdf-charts.ts`), pasando `items: summary.porTipo.map((t, i) => ({ label: t.nombre, value: t.cantidad, color: hexToRgb(PALETTE[i % 8]) }))` (todos los tipos, incluyendo más de 8 — el helper ya maneja N barras). Se agrega un pequeño helper `hexToRgb` local (o inline) ya que `drawHorizontalBarChart` espera tuplas `[r,g,b]` y la paleta está en hex. El bloque de KPIs (`drawKpiRow`, si se usa) no cambia de posición, solo la sección de tipos pasa de tabla a barras.

## Fuera de alcance

- No se agrega gráfico de tendencia diaria al PDF (el PDF se queda con KPIs + barra de tipos + tabla detalle; la tendencia es solo pantalla, para no sobrecargar el PDF).
- No se persiste la preferencia de `pageSize` entre sesiones.
- No se agrega paginación a la tabla de exportación CSV/PDF del reporte de ayudas (Parte B) — esa sigue exportando el rango completo, solo la vista en pantalla de "Ayudas entregadas" (Parte A, registro operativo) gana paginación.
