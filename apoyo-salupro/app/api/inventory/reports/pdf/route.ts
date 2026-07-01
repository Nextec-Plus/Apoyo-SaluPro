import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildInventoryReportData, getCenterId } from '@/lib/reportes/inventory-report-data'
import { buildInventoryReportPdf, pdfResponse } from '@/lib/reportes/inventory-pdf'

/* ────────────────────────────────────────────────────────────────────────────
 * GET /api/inventory/reports/pdf?from=ISO&to=ISO&umbral=5
 *
 * Mismo dataset que /api/inventory/reports, pero devuelto como PDF con logo,
 * KPIs, gráficos de barra y tablas — para distribuir a stakeholders.
 * ──────────────────────────────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const centerId = await getCenterId(supabase)
  if (!centerId) return Response.json({ error: 'Sin asignación de centro' }, { status: 403 })

  const { searchParams } = request.nextUrl
  const now = new Date()
  const defFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const from = searchParams.get('from') || defFrom.toISOString()
  const to = searchParams.get('to') || now.toISOString()
  const umbral = Math.max(1, Number(searchParams.get('umbral')) || 5)

  try {
    const data = await buildInventoryReportData(supabase, centerId, from, to, umbral)
    const pdf = buildInventoryReportPdf({ error: null, ...data })
    const stamp = new Date().toISOString().slice(0, 10)
    return pdfResponse(pdf, `reporte-salupro-${stamp}.pdf`)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Error al generar el PDF' },
      { status: 500 },
    )
  }
}
