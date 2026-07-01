import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildInventoryReportData, getCenterId } from '@/lib/reportes/inventory-report-data'

/* ────────────────────────────────────────────────────────────────────────────
 * GET /api/inventory/reports?from=ISO&to=ISO&umbral=5
 *
 * Agregación server-side para los reportes de stakeholders. Acotado al centro
 * del usuario vía su asignación (RLS). Devuelve KPIs, distribución de ayuda,
 * cruce solicitudes↔inventario, alertas de faltantes y auditoría/productividad.
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
    const report = await buildInventoryReportData(supabase, centerId, from, to, umbral)
    return Response.json({ error: null, ...report })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Error al generar el reporte' },
      { status: 500 },
    )
  }
}
