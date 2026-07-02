# Reporte de Ayudas Humanitarias — Diseño

## Contexto

`TabAyudas` (`apoyo-salupro/app/dashboard/tabs/tab-ayudas.tsx`) registra entregas de ayuda humanitaria: cédula, nombre, lista de ítems (tipo + cantidad), timestamp. `TabReportes` (`apoyo-salupro/app/dashboard/tabs/tab-reportes.tsx`) ya expone reportes de pacientes/desaparecidos con exportación CSV/PDF, y una card de "Ingresos por día" con selector de fecha única + exportación (`app/api/reportes/ingresos-hoy/`). Este diseño agrega un reporte análogo para ayudas, con filtro por **rango** de fechas en vez de un solo día, dirigido a stakeholders (debe verse pulido, con logo SaluPro).

## Objetivo

Nueva card "Reporte de Ayudas" en `TabReportes`, ubicada inmediatamente debajo de "Ingresos por día", que permite:
1. Elegir un rango de fechas (desde/hasta, calendario, hora Venezuela).
2. Ver un resumen agregado del rango: total de personas atendidas (entregas) y total de personas únicas (por cédula), y cantidad total entregada por cada tipo de ayuda.
3. Exportar el detalle (persona, ayudas entregadas, fecha/hora) en CSV o PDF. El PDF incluye el resumen agregado y el logo de SaluPro, con calidad de presentación para stakeholders.

## Backend

### `lib/reportes/ayudas/date-bounds.ts`
Convierte `start`/`end` (`YYYY-MM-DD`, interpretados en hora Venezuela) a bounds UTC (`>= start 04:00:00 UTC`, `< (end+1día) 04:00:00 UTC`), reutilizando la lógica de `ingresos-hoy/date-bounds.ts` pero para un rango de dos fechas en vez de un solo día.

### `lib/reportes/ayudas/export-data.ts`
`buildAyudasReportePayload(organizationId, supabase, start, end)`:
- Query paginada (500/página, igual patrón que `ingresos-hoy/export-data.ts`) a `ayuda_entregas` con `ayuda_entrega_items(*, ayuda_tipos(id, nombre))`, filtrado por `organization_id` y rango `created_at`, orden descendente.
- Devuelve:
  - `title`, `subtitle`, `filenameBase` (ej. `ayudas-2026-06-21_2026-07-02`).
  - `headers`/`rows` para tabla detalle: Cédula, Nombre, Ayudas entregadas (concatenado "2× Arroz · 1× Cobijas"), Fecha/hora.
  - `summary`: `{ totalEntregas: number; totalPersonasUnicas: number; porTipo: { nombre: string; cantidad: number }[] }` (porTipo ordenado desc por cantidad).

### `lib/reportes/ayudas/pdf.ts`
`buildAyudasReportePdf(payload)` con jsPDF + autoTable, mismo header con logo SaluPro que `ingresos-hoy/pdf.ts` (`drawPdfHeader`, reutilizar o duplicar función). Estructura:
1. Header: logo + título + rango + fecha de generación.
2. Bloque resumen: 3 tarjetas/stats (Total entregas, Personas únicas, Tipos de ayuda distintos) + tabla compacta "Tipo de ayuda → Cantidad total" (ordenada desc).
3. Tabla detalle (autoTable): Cédula, Nombre, Ayudas, Fecha.

### Endpoints

- `GET /api/reportes/ayudas/summary?organization_id=&start=&end=` → JSON con el `summary` (para refrescar la card en pantalla al cambiar rango). Valida `start<=end`, formato `YYYY-MM-DD`.
- `GET /api/reportes/ayudas/export?format=csv|pdf&organization_id=&start=&end=` → mismo patrón que `ingresos-hoy/export`: arma payload, responde CSV (`csvResponse`/`rowsToCsv`) o PDF (`pdfResponse`).

Ambos usan `requireReportAuth()` (igual que los demás endpoints de `/api/reportes`) y `createServiceClient()`.

## Frontend

Nuevo componente `AyudasReporteCard` dentro de `tab-reportes.tsx` (mismo archivo, mismo patrón que `IngresosPorFechaCard`), insertado entre la card de "Ingresos por día" y el cierre del `<div className="space-y-6">`.

- Dos inputs `type="date"` (Desde / Hasta), `max` = hoy VET, `Desde` no puede ser posterior a `Hasta`.
- Al cambiar el rango (debounce simple o al soltar el input), hace fetch a `/api/reportes/ayudas/summary` y muestra:
  - 2 stat tiles pequeños (Total entregas, Personas únicas) usando el mismo `StatCard` ya existente en el archivo.
  - Lista/badges de "top tipos de ayuda" del rango (nombre + cantidad), estilo similar a `AyudasBadges` de `tab-ayudas.tsx` pero solo lectura.
- Selector CSV/PDF + botón "Generar" (idéntico patrón visual a `IngresosPorFechaCard`), descarga el archivo via `/api/reportes/ayudas/export`.
- Estado de carga/():`generating`, reutiliza el mismo `ExportFormat` type ya definido en el archivo.
- Diseño visual pulido (stakeholder-facing): se aplican las convenciones de `design-taste-frontend` y `emil-design-eng` (jerarquía tipográfica clara, spacing generoso, micro-interacciones consistentes con el resto del dashboard) al maquetar la card y el PDF.

## Fuera de alcance

- No se modifica el registro de ayudas (`tab-ayudas.tsx`) ni sus endpoints existentes.
- No se agregan gráficos/charts en el PDF (solo tabla de totales); si se desea un gráfico tipo barra se puede añadir después reutilizando `lib/reportes/pdf-charts.ts`.
- No se persiste el rango de fechas elegido (se resetea al recargar la página).
