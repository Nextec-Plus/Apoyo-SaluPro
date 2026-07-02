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
