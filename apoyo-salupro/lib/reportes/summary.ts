import { getOrganizationId } from "@/lib/config";
import { scopeMissingPersonsByOrg } from "@/lib/reportes/missing-persons-scope";
import { createServiceClient } from "@/lib/supabase/server";
import type { CareState, MissingPersonStatus, TriageCategory } from "@/lib/types/database";

export type ReportesSummary = {
  pacientes: {
    total: number;
    triaje: Record<TriageCategory, number>;
    estados: Record<CareState, number>;
  };
  desaparecidos: {
    /** Todos los reportes ingresados (cualquier estado). */
    total: number;
    desaparecidos: number;
    encontrados: number;
    fallecidos: number;
  };
  generado_en: string;
};

export async function buildReportesSummary(
  organizationId?: string,
): Promise<ReportesSummary> {
  const organization_id = organizationId ?? getOrganizationId();
  const supabase = await createServiceClient();

  const [
    pacientesTotalRes,
    triajeRes,
    estadosRes,
    mpTotalRes,
    mpDesaparecidoRes,
    mpEncontradoRes,
    mpFallecidoRes,
  ] = await Promise.all([
    supabase
      .from("catastrophe_victims")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organization_id),
    supabase
      .from("catastrophe_victim_info")
      .select("triage_category")
      .eq("organization_id", organization_id),
    supabase
      .from("catastrophe_victim_info")
      .select("estado_destino")
      .eq("organization_id", organization_id),
    scopeMissingPersonsByOrg(
      supabase.from("missing_persons").select("*", { count: "exact", head: true }),
      organization_id,
    ),
    scopeMissingPersonsByOrg(
      supabase
        .from("missing_persons")
        .select("*", { count: "exact", head: true })
        .eq("estado", "Desaparecido" as MissingPersonStatus),
      organization_id,
    ),
    scopeMissingPersonsByOrg(
      supabase
        .from("missing_persons")
        .select("*", { count: "exact", head: true })
        .eq("estado", "Encontrado" as MissingPersonStatus),
      organization_id,
    ),
    scopeMissingPersonsByOrg(
      supabase
        .from("missing_persons")
        .select("*", { count: "exact", head: true })
        .eq("estado", "Confirmado Fallecido" as MissingPersonStatus),
      organization_id,
    ),
  ]);

  if (pacientesTotalRes.error) {
    throw new Error(pacientesTotalRes.error.message);
  }

  const triaje: Record<TriageCategory, number> = {
    Verde: 0,
    Amarillo: 0,
    Rojo: 0,
  };
  for (const row of triajeRes.data ?? []) {
    if (row.triage_category in triaje) {
      triaje[row.triage_category as TriageCategory]++;
    }
  }

  const estados: Record<CareState, number> = {
    Triaje: 0,
    "En Atención": 0,
    Hospitalizado: 0,
    Transferido: 0,
    "Alta Médica": 0,
    Anulado: 0,
  };
  for (const row of estadosRes.data ?? []) {
    if (row.estado_destino in estados) {
      estados[row.estado_destino as CareState]++;
    }
  }

  return {
    pacientes: {
      total: pacientesTotalRes.count ?? 0,
      triaje,
      estados,
    },
    desaparecidos: {
      total: mpTotalRes.count ?? 0,
      desaparecidos: mpDesaparecidoRes.count ?? 0,
      encontrados: mpEncontradoRes.count ?? 0,
      fallecidos: mpFallecidoRes.count ?? 0,
    },
    generado_en: new Date().toISOString(),
  };
}
