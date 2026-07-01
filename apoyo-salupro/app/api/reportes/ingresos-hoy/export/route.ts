import type { NextRequest } from "next/server";
import { getOrganizationId } from "@/lib/config";
import { csvResponse, rowsToCsv } from "@/lib/reportes/csv";
import { buildIngresosHoyPayload } from "@/lib/reportes/ingresos-hoy/export-data";
import { buildIngresosHoyPdf, pdfResponse } from "@/lib/reportes/ingresos-hoy/pdf";
import { requireReportAuth } from "@/lib/reportes/require-auth";
import { createServiceClient } from "@/lib/supabase/server";

const EXPORT_FORMATS = new Set(["csv", "pdf"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/reportes/ingresos-hoy/export?format=csv|pdf&date=YYYY-MM-DD
 *
 * Descarga ingresos de un día (hora Venezuela) en CSV o PDF. Sin `date`, usa hoy.
 */
export async function GET(request: NextRequest) {
  const authError = await requireReportAuth();
  if (authError) return authError;

  const { searchParams } = request.nextUrl;
  const format = searchParams.get("format") ?? "csv";
  const organization_id = searchParams.get("organization_id") ?? getOrganizationId();
  const date = searchParams.get("date") ?? undefined;

  if (!EXPORT_FORMATS.has(format)) {
    return Response.json({ error: "format inválido. Use: csv o pdf" }, { status: 400 });
  }
  if (date && !DATE_RE.test(date)) {
    return Response.json({ error: "date inválido. Use: YYYY-MM-DD" }, { status: 400 });
  }

  try {
    const supabase = await createServiceClient();
    const payload = await buildIngresosHoyPayload(organization_id, supabase, date);
    const filename = `${payload.filenameBase}.${format}`;

    if (format === "pdf") {
      const pdf = buildIngresosHoyPdf(payload);
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
