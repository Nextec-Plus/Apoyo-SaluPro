import { DESTINOS_ALTA_TRASLADO, DESTINO_OTROS } from "@/lib/catastrophe-destinos";
import { generoDbToUi } from "@/lib/config";
import { scopeMissingPersonsByOrg } from "@/lib/reportes/missing-persons-scope";
import {
  buildReportesSummary,
  formatReportDate,
  type ReportPatientRow,
  type ReportesSummary,
} from "@/lib/reportes/summary";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MissingPerson, MissingPersonStatus } from "@/lib/types/database";

export type ExportType =
  | "resumen"
  | "pacientes"
  | "desaparecidos"
  | "encontrados"
  | "fallecidos";

export type ResumenPatientRow = {
  cells: string[];
  triage: "Verde" | "Amarillo" | "Rojo" | null;
};

export type ExportPayload = {
  exportType: ExportType;
  title: string;
  subtitle?: string;
  filenameBase: string;
  headers: string[];
  rows: unknown[][];
  /** Solo para resumen: datos para gráficos y KPIs en PDF. */
  summary?: ReportesSummary;
  /** Solo para resumen PDF: pacientes en observación. */
  observationPatientList?: {
    headers: string[];
    rows: ResumenPatientRow[];
  };
  /** Solo para resumen PDF: pacientes dados de alta / trasladados. */
  dischargedPatientList?: {
    headers: string[];
    rows: ResumenPatientRow[];
  };
  /** Solo para resumen PDF: localizados / a salvo sin ficha de triaje. */
  localizadosPatientList?: {
    headers: string[];
    rows: ResumenPatientRow[];
  };
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-VE", { timeZone: "America/Caracas" });
}

function victimInfo(
  info:
    | {
        triage_category: string;
        estado_destino: string;
        motivo_principal_consulta: string | null;
        condiciones_preexistentes: string | null;
        alergias: string | null;
        tratamiento_medicamentos: string | null;
        fecha_hora_entrada: string;
      }
    | Array<{
        triage_category: string;
        estado_destino: string;
        motivo_principal_consulta: string | null;
        condiciones_preexistentes: string | null;
        alergias: string | null;
        tratamiento_medicamentos: string | null;
        fecha_hora_entrada: string;
      }>
    | null
    | undefined,
) {
  if (!info) return null;
  return Array.isArray(info) ? info[0] ?? null : info;
}

function observationRowToResumen(row: ReportPatientRow): ResumenPatientRow {
  const triage =
    row.triage_category === "Verde" ||
    row.triage_category === "Amarillo" ||
    row.triage_category === "Rojo"
      ? row.triage_category
      : null;
  return {
    triage,
    cells: [
      row.registration_number ?? "—",
      row.nombre_completo,
      row.triage_category ?? "—",
      row.motivo_principal_consulta?.trim() || "—",
      formatReportDate(row.fecha_hora_entrada),
    ],
  };
}

function dischargedRowToResumen(row: ReportPatientRow): ResumenPatientRow {
  return {
    triage: null,
    cells: [
      row.registration_number ?? "—",
      row.nombre_completo,
      row.destino,
      row.estado_destino ?? "—",
      formatReportDate(row.fecha_hora_entrada),
    ],
  };
}

function localizadoRowToResumen(row: ReportPatientRow): ResumenPatientRow {
  return {
    triage: null,
    cells: [
      row.registration_number ?? "—",
      row.nombre_completo,
      row.destino?.replace(/\s+/g, " ").trim() || "—",
    ],
  };
}

function buildResumenCsvRows(summary: ReportesSummary): unknown[][] {
  const obs = summary.pacientes.en_observacion;
  const alta = summary.pacientes.dados_alta_traslado;
  const rows: unknown[][] = [
    ["Pacientes", "Total pacientes", summary.pacientes.total],
    ["En observación", "Total en observación", obs.total],
    ["En observación", "Triaje verde", obs.triaje.Verde],
    ["En observación", "Triaje amarillo", obs.triaje.Amarillo],
    ["En observación", "Triaje rojo", obs.triaje.Rojo],
    ["Dados de alta / traslados", "Total", alta.total],
  ];
  for (const destino of DESTINOS_ALTA_TRASLADO) {
    rows.push(["Dados de alta / traslados", destino, alta.por_destino[destino] ?? 0]);
  }
  if ((alta.por_destino[DESTINO_OTROS] ?? 0) > 0) {
    rows.push(["Dados de alta / traslados", DESTINO_OTROS, alta.por_destino[DESTINO_OTROS]]);
  }
  rows.push([
    "Localizados / a salvo",
    "Total (sin ficha de triaje)",
    summary.pacientes.localizados.total,
  ]);
  rows.push(
    ["Desaparecidos", "Total registrados", summary.desaparecidos.total],
    ["Desaparecidos", "Desaparecidos", summary.desaparecidos.desaparecidos],
    ["Desaparecidos", "Encontrados", summary.desaparecidos.encontrados],
    ["Desaparecidos", "Fallecidos", summary.desaparecidos.fallecidos],
  );
  return rows;
}

export async function buildExportPayload(
  type: ExportType,
  organizationId: string,
  supabase: SupabaseClient<Database>,
): Promise<ExportPayload> {
  if (type === "resumen") {
    const summary = await buildReportesSummary(organizationId);

    return {
      exportType: "resumen",
      title: "Resumen operativo — Apoyo SaluPro",
      subtitle: "Terremoto La Guaira · Control de crisis",
      filenameBase: "reporte-resumen",
      summary,
      observationPatientList: {
        headers: ["Registro", "Nombre", "Triaje", "Motivo", "Ingreso"],
        rows: summary.pacientes.en_observacion.pacientes.map(observationRowToResumen),
      },
      dischargedPatientList: {
        headers: ["Registro", "Nombre", "Destino", "Estado", "Ingreso"],
        rows: summary.pacientes.dados_alta_traslado.pacientes.map(dischargedRowToResumen),
      },
      localizadosPatientList: {
        headers: ["Registro", "Nombre", "Estado / ubicación"],
        rows: summary.pacientes.localizados.pacientes.map(localizadoRowToResumen),
      },
      headers: ["Sección", "Indicador", "Cantidad"],
      rows: buildResumenCsvRows(summary),
    };
  }

  if (type === "pacientes") {
    const summary = await buildReportesSummary(organizationId);
    const { data, error } = await supabase
      .from("catastrophe_victims")
      .select(
        "registration_number, nombre_completo, cedula, edad, genero, telefono_contacto, sector_comunidad, nombre_edificio_casa, numero_apartamento_casa, ubicacion_actual_refugio, notas, created_at, catastrophe_victim_info(triage_category, estado_destino, motivo_principal_consulta, condiciones_preexistentes, alergias, tratamiento_medicamentos, fecha_hora_entrada)",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const headers = [
      "N° Registro",
      "Nombre completo",
      "Cédula",
      "Edad",
      "Género",
      "Teléfono",
      "Sector/Comunidad",
      "Edificio/Casa",
      "Apto/Casa",
      "Ubicación actual/Refugio",
      "Triaje",
      "Estado atención",
      "Motivo consulta",
      "Condiciones preexistentes",
      "Alergias",
      "Tratamiento/Medicamentos",
      "Fecha ingreso",
      "Fecha registro",
      "Notas",
    ];

    const rows = (data ?? []).map((v) => {
      const info = victimInfo(v.catastrophe_victim_info);
      return [
        v.registration_number,
        v.nombre_completo,
        v.cedula,
        v.edad,
        generoDbToUi(v.genero),
        v.telefono_contacto,
        v.sector_comunidad,
        v.nombre_edificio_casa,
        v.numero_apartamento_casa,
        v.ubicacion_actual_refugio,
        info?.triage_category ?? "",
        info?.estado_destino ?? "",
        info?.motivo_principal_consulta,
        info?.condiciones_preexistentes,
        info?.alergias,
        info?.tratamiento_medicamentos,
        formatDate(info?.fecha_hora_entrada),
        formatDate(v.created_at),
        v.notas,
      ];
    });

    return {
      exportType: "pacientes",
      title: "Lista de pacientes — Apoyo SaluPro",
      subtitle: `${rows.length} registro(s)`,
      filenameBase: "pacientes",
      summary,
      headers,
      rows,
    };
  }

  const meta: Record<
    Exclude<ExportType, "resumen" | "pacientes">,
    { estado: MissingPersonStatus; title: string; filenameBase: string }
  > = {
    desaparecidos: {
      estado: "Desaparecido",
      title: "Personas desaparecidas — Apoyo SaluPro",
      filenameBase: "desaparecidos",
    },
    encontrados: {
      estado: "Encontrado",
      title: "Personas encontradas — Apoyo SaluPro",
      filenameBase: "encontrados",
    },
    fallecidos: {
      estado: "Confirmado Fallecido",
      title: "Personas fallecidas — Apoyo SaluPro",
      filenameBase: "fallecidos",
    },
  };

  const { estado, title, filenameBase } = meta[type];

  if (type === "fallecidos") {
    const { data, error } = await scopeMissingPersonsByOrg(
      supabase
        .from("missing_persons")
        .select(
          "nombre, apellido, cedula, edad_aproximada, genero, motivo_fallecimiento, fallecimiento_confirmado, informacion_adicional, contacto_nombre, contacto_apellido, contacto_correo, contacto_telefono_nacional, contacto_telefono_internacional, created_at, updated_at",
        )
        .eq("estado", estado)
        .order("created_at", { ascending: false }),
      organizationId,
    );

    if (error) throw new Error(error.message);

    const headers = [
      "Nombre",
      "Apellido",
      "Cédula",
      "Edad aprox.",
      "Género",
      "Motivo fallecimiento",
      "Confirmado desaparición",
      "Información adicional",
      "Contacto nombre",
      "Contacto apellido",
      "Contacto correo",
      "Teléfono nacional",
      "Teléfono internacional",
      "Fecha reporte",
      "Última actualización",
    ];

    const rows = (data ?? []).map((p: MissingPerson) => [
      p.nombre,
      p.apellido,
      p.cedula,
      p.edad_aproximada,
      generoDbToUi(p.genero),
      p.motivo_fallecimiento,
      p.fallecimiento_confirmado ? "Sí" : "No",
      p.informacion_adicional,
      p.contacto_nombre,
      p.contacto_apellido,
      p.contacto_correo,
      p.contacto_telefono_nacional,
      p.contacto_telefono_internacional,
      formatDate(p.created_at),
      formatDate(p.updated_at),
    ]);

    return {
      exportType: type,
      title,
      subtitle: `${rows.length} registro(s)`,
      filenameBase,
      headers,
      rows,
    };
  }

  const { data, error } = await scopeMissingPersonsByOrg(
    supabase
      .from("missing_persons")
      .select(
        "nombre, apellido, cedula, edad_aproximada, genero, ultimo_lugar_visto, informacion_adicional, contacto_nombre, contacto_apellido, contacto_correo, contacto_telefono_nacional, contacto_telefono_internacional, created_at, updated_at",
      )
      .eq("estado", estado)
      .order("created_at", { ascending: false }),
    organizationId,
  );

  if (error) throw new Error(error.message);

  const headers = [
    "Nombre",
    "Apellido",
    "Cédula",
    "Edad aprox.",
    "Género",
    "Último lugar visto",
    "Información adicional",
    "Contacto nombre",
    "Contacto apellido",
    "Contacto correo",
    "Teléfono nacional",
    "Teléfono internacional",
    "Fecha reporte",
    "Última actualización",
  ];

  const rows = (data ?? []).map((p: MissingPerson) => [
    p.nombre,
    p.apellido,
    p.cedula,
    p.edad_aproximada,
    generoDbToUi(p.genero),
    p.ultimo_lugar_visto,
    p.informacion_adicional,
    p.contacto_nombre,
    p.contacto_apellido,
    p.contacto_correo,
    p.contacto_telefono_nacional,
    p.contacto_telefono_internacional,
    formatDate(p.created_at),
    formatDate(p.updated_at),
  ]);

  return {
    exportType: type,
    title,
    subtitle: `${rows.length} registro(s)`,
    filenameBase,
    headers,
    rows,
  };
}
