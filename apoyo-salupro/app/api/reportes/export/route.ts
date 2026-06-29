import type { NextRequest } from "next/server";
import { getOrganizationId } from "@/lib/config";
import { csvResponse, rowsToCsv } from "@/lib/reportes/csv";
import { buildExportPayload, type ExportType } from "@/lib/reportes/export-data";
import { buildReportPdf, pdfResponse } from "@/lib/reportes/pdf";
import { requireReportAuth } from "@/lib/reportes/require-auth";
import { createServiceClient } from "@/lib/supabase/server";

const EXPORT_TYPES = new Set<string>([
  "pacientes",
  "pacientes-triaje",
  "desaparecidos",
  "encontrados",
  "fallecidos",
  "resumen",
]);

const EXPORT_FORMATS = new Set(["csv", "pdf"]);

/**
 * GET /api/reportes/export?type=...&format=csv|pdf
 *
 * Descarga CSV o PDF del dataset solicitado (requiere sesión).
 */
export async function GET(request: NextRequest) {
  const authError = await requireReportAuth();
  if (authError) return authError;

  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");
  const format = searchParams.get("format") ?? "csv";
  const organization_id = searchParams.get("organization_id") ?? getOrganizationId();

  if (!type || !EXPORT_TYPES.has(type)) {
    return Response.json(
      { error: "type inválido. Use: pacientes, desaparecidos, encontrados, fallecidos, resumen" },
      { status: 400 },
    );
  }

  if (!EXPORT_FORMATS.has(format)) {
    return Response.json({ error: "format inválido. Use: csv o pdf" }, { status: 400 });
  }

  const stamp = new Date().toISOString().slice(0, 10);

  try {
    const supabase = await createServiceClient();
    const payload = await buildExportPayload(type as ExportType, organization_id, supabase);
    const filename = `${payload.filenameBase}-${stamp}.${format}`;

    if (format === "pdf") {
      const pdf = buildReportPdf(payload);
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
