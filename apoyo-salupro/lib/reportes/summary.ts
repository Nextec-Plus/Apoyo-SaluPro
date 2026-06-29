import {
  bucketDestinoAltaTraslado,
  DESTINOS_ALTA_TRASLADO,
  DESTINO_OTROS,
  isPacienteDadoDeAltaOTraslado,
  isPacienteEnObservacion,
  isEnObservacionModulo,
  resolveDestinoPaciente,
} from "@/lib/catastrophe-destinos";
import { getOrganizationId } from "@/lib/config";
import { scopeMissingPersonsByOrg } from "@/lib/reportes/missing-persons-scope";
import { createServiceClient } from "@/lib/supabase/server";
import type { CareState, MissingPersonStatus, TriageCategory } from "@/lib/types/database";
import type { ReportPatientRow, ReportesSummary } from "@/lib/reportes/summary-types";
export type { ReportPatientRow, ReportesSummary } from "@/lib/reportes/summary-types";
export { formatReportDate } from "@/lib/reportes/summary-types";

const TRIAGE_ORDER: Record<TriageCategory, number> = {
  Rojo: 0,
  Amarillo: 1,
  Verde: 2,
};

function emptyTriaje(): Record<TriageCategory, number> {
  return { Verde: 0, Amarillo: 0, Rojo: 0 };
}

function emptyEstados(): Record<CareState, number> {
  return {
    Triaje: 0,
    "En Atención": 0,
    Hospitalizado: 0,
    Transferido: 0,
    "Alta Médica": 0,
    Anulado: 0,
  };
}

function emptyPorDestino(): Record<string, number> {
  const buckets: Record<string, number> = {};
  for (const d of DESTINOS_ALTA_TRASLADO) buckets[d] = 0;
  buckets[DESTINO_OTROS] = 0;
  return buckets;
}

function sortObservationPatients(rows: ReportPatientRow[]): ReportPatientRow[] {
  return [...rows].sort((a, b) => {
    const ta = a.triage_category ? TRIAGE_ORDER[a.triage_category] : 99;
    const tb = b.triage_category ? TRIAGE_ORDER[b.triage_category] : 99;
    if (ta !== tb) return ta - tb;
    const da = a.fecha_hora_entrada ?? "";
    const db = b.fecha_hora_entrada ?? "";
    return da.localeCompare(db);
  });
}

function sortDischargedPatients(rows: ReportPatientRow[]): ReportPatientRow[] {
  return [...rows].sort((a, b) => {
    const da = a.fecha_hora_entrada ?? "";
    const db = b.fecha_hora_entrada ?? "";
    return da.localeCompare(db);
  });
}

type VictimRow = {
  id: string;
  registration_number: string | null;
  nombre_completo: string;
  notas: string | null;
  catastrophe_victim_info:
    | {
        triage_category: TriageCategory;
        estado_destino: CareState;
        motivo_principal_consulta: string | null;
        fecha_hora_entrada: string;
      }
    | Array<{
        triage_category: TriageCategory;
        estado_destino: CareState;
        motivo_principal_consulta: string | null;
        fecha_hora_entrada: string;
      }>
    | null;
};

function victimInfo(row: VictimRow) {
  const info = row.catastrophe_victim_info;
  if (!info) return null;
  return Array.isArray(info) ? info[0] ?? null : info;
}

function estadoParaClasificacion(
  notas: string | null | undefined,
  estado_destino: CareState | null | undefined,
): CareState | null {
  if (estado_destino) return estado_destino;
  return isEnObservacionModulo(notas) ? "Triaje" : null;
}

export async function buildReportesSummary(
  organizationId?: string,
): Promise<ReportesSummary> {
  const organization_id = organizationId ?? getOrganizationId();
  const supabase = await createServiceClient();

  const [
    pacientesTotalRes,
    victimsRes,
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
      .from("catastrophe_victims")
      .select(
        "id, registration_number, nombre_completo, notas, catastrophe_victim_info(triage_category, estado_destino, motivo_principal_consulta, fecha_hora_entrada)",
      )
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
  if (victimsRes.error) {
    throw new Error(victimsRes.error.message);
  }

  const triaje = emptyTriaje();
  const estados = emptyEstados();
  const obsTriaje = emptyTriaje();
  const porDestino = emptyPorDestino();
  const observationRows: ReportPatientRow[] = [];
  const dischargedRows: ReportPatientRow[] = [];
  const localizadosRows: ReportPatientRow[] = [];

  for (const v of (victimsRes.data ?? []) as VictimRow[]) {
    const info = victimInfo(v);
    const estado_destino = info?.estado_destino ?? null;
    const estadoClasificacion = estadoParaClasificacion(v.notas, estado_destino);
    const destino = resolveDestinoPaciente(v.notas, estadoClasificacion);
    const row: ReportPatientRow = {
      id: v.id,
      registration_number: v.registration_number,
      nombre_completo: v.nombre_completo,
      triage_category: info?.triage_category ?? null,
      destino,
      estado_destino,
      fecha_hora_entrada: info?.fecha_hora_entrada ?? null,
      motivo_principal_consulta: info?.motivo_principal_consulta ?? null,
    };

    if (info?.triage_category && info.triage_category in triaje) {
      triaje[info.triage_category as TriageCategory]++;
    }
    if (estado_destino && estado_destino in estados) {
      estados[estado_destino as CareState]++;
    }

    if (isPacienteEnObservacion(v.notas, estadoClasificacion)) {
      observationRows.push(row);
      if (info?.triage_category && info.triage_category in obsTriaje) {
        obsTriaje[info.triage_category as TriageCategory]++;
      }
    } else if (isPacienteDadoDeAltaOTraslado(v.notas, estadoClasificacion)) {
      dischargedRows.push({
        ...row,
        destino: v.notas?.trim() || destino,
      });
      const bucket = bucketDestinoAltaTraslado(v.notas, estadoClasificacion);
      porDestino[bucket] = (porDestino[bucket] ?? 0) + 1;
    } else {
      // Ni observación ni alta/traslado: p. ej. importados "localizada / a salvo"
      // sin ficha de triaje. Se listan aparte para reconciliar el total.
      localizadosRows.push(row);
    }
  }

  return {
    pacientes: {
      total: pacientesTotalRes.count ?? 0,
      triaje,
      estados,
      en_observacion: {
        total: observationRows.length,
        triaje: obsTriaje,
        pacientes: sortObservationPatients(observationRows),
      },
      dados_alta_traslado: {
        total: dischargedRows.length,
        por_destino: porDestino,
        pacientes: sortDischargedPatients(dischargedRows),
      },
      localizados: {
        total: localizadosRows.length,
        pacientes: sortDischargedPatients(localizadosRows),
      },
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
