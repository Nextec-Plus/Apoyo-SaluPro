import type { NextRequest } from "next/server";
import { getOrganizationId } from "@/lib/config";
import { requireReportAuth } from "@/lib/reportes/require-auth";
import { buildReportesSummary } from "@/lib/reportes/summary";

export type { ReportesSummary } from "@/lib/reportes/summary";

/**
 * GET /api/reportes/summary
 *
 * Resumen agregado para el módulo de reportes (requiere sesión).
 */
export async function GET(request: NextRequest) {
  const authError = await requireReportAuth();
  if (authError) return authError;

  const organization_id =
    request.nextUrl.searchParams.get("organization_id") ?? getOrganizationId();

  try {
    const summary = await buildReportesSummary(organization_id);
    const res = Response.json(summary);
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Error al generar resumen" },
      { status: 500 },
    );
  }
}
