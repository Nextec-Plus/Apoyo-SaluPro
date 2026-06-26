import type { CareState, TriageCategory } from "@/lib/types/database";

/** Client-safe types and helpers for reportes (no server imports). */

export type ReportPatientRow = {
  id: string;
  registration_number: string | null;
  nombre_completo: string;
  triage_category: TriageCategory | null;
  destino: string;
  estado_destino: CareState | null;
  fecha_hora_entrada: string | null;
  motivo_principal_consulta: string | null;
};

export type ReportesSummary = {
  pacientes: {
    total: number;
    triaje: Record<TriageCategory, number>;
    estados: Record<CareState, number>;
    en_observacion: {
      total: number;
      triaje: Record<TriageCategory, number>;
      pacientes: ReportPatientRow[];
    };
    dados_alta_traslado: {
      total: number;
      por_destino: Record<string, number>;
      pacientes: ReportPatientRow[];
    };
  };
  desaparecidos: {
    total: number;
    desaparecidos: number;
    encontrados: number;
    fallecidos: number;
  };
  generado_en: string;
};

export function formatReportDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
