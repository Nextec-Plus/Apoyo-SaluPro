import { generoDbToUi } from "@/lib/config";
import { scopeMissingPersonsByOrg } from "@/lib/reportes/missing-persons-scope";
import { buildReportesSummary, type ReportesSummary } from "@/lib/reportes/summary";
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
  /** Solo para resumen PDF: listado de pacientes al final del documento. */
  patientList?: {
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

export async function buildExportPayload(
  type: ExportType,
  organizationId: string,
  supabase: SupabaseClient<Database>,
): Promise<ExportPayload> {
  if (type === "resumen") {
    const summary = await buildReportesSummary(organizationId);

    const { data: patients, error: patientsError } = await supabase
      .from("catastrophe_victims")
      .select(
        "nombre_completo, sector_comunidad, catastrophe_victim_info(motivo_principal_consulta, fecha_hora_entrada, triage_category)",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (patientsError) throw new Error(patientsError.message);

    const patientListRows: ResumenPatientRow[] = (patients ?? []).map((v) => {
      const info = v.catastrophe_victim_info;
      const row = Array.isArray(info) ? info[0] ?? null : info;
      const triage = row?.triage_category;
      const triageColor =
        triage === "Verde" || triage === "Amarillo" || triage === "Rojo" ? triage : null;
      return {
        triage: triageColor,
        cells: [
          v.nombre_completo,
          row?.motivo_principal_consulta?.trim() || "—",
          formatDate(row?.fecha_hora_entrada),
          v.sector_comunidad?.trim() || "—",
        ],
      };
    });

    return {
      exportType: "resumen",
      title: "Resumen operativo — Apoyo SaluPro",
      subtitle: "Terremoto La Guaira · Control de crisis",
      filenameBase: "reporte-resumen",
      summary,
      patientList: {
        headers: ["Nombre", "Sintomatología", "Fecha de ingreso", "Sector"],
        rows: patientListRows,
      },
      headers: ["Sección", "Indicador", "Cantidad"],
      rows: [
        ["Pacientes", "Total pacientes", summary.pacientes.total],
        ["Pacientes", "Triaje verde", summary.pacientes.triaje.Verde],
        ["Pacientes", "Triaje amarillo", summary.pacientes.triaje.Amarillo],
        ["Pacientes", "Triaje rojo", summary.pacientes.triaje.Rojo],
        ["Desaparecidos", "Total registrados", summary.desaparecidos.total],
        ["Desaparecidos", "Desaparecidos", summary.desaparecidos.desaparecidos],
        ["Desaparecidos", "Encontrados", summary.desaparecidos.encontrados],
        ["Desaparecidos", "Fallecidos", summary.desaparecidos.fallecidos],
      ],
    };
  }

  if (type === "pacientes") {
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
