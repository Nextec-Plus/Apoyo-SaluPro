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
