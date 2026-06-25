import type { NextRequest } from "next/server";
import { generoDbToUi, getOrganizationId } from "@/lib/config";
import { csvResponse, rowsToCsv } from "@/lib/reportes/csv";
import { scopeMissingPersonsByOrg } from "@/lib/reportes/missing-persons-scope";
import { requireReportAuth } from "@/lib/reportes/require-auth";
import { buildReportesSummary } from "@/lib/reportes/summary";
import { createServiceClient } from "@/lib/supabase/server";
import type { MissingPerson, MissingPersonStatus } from "@/lib/types/database";

const EXPORT_TYPES = new Set([
  "pacientes",
  "desaparecidos",
  "encontrados",
  "fallecidos",
  "resumen",
]);

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

/**
 * GET /api/reportes/export?type=pacientes|desaparecidos|encontrados|fallecidos|resumen
 *
 * Descarga CSV del dataset solicitado (requiere sesión).
 */
export async function GET(request: NextRequest) {
  const authError = await requireReportAuth();
  if (authError) return authError;

  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");
  const organization_id = searchParams.get("organization_id") ?? getOrganizationId();

  if (!type || !EXPORT_TYPES.has(type)) {
    return Response.json(
      { error: "type inválido. Use: pacientes, desaparecidos, encontrados, fallecidos, resumen" },
      { status: 400 },
    );
  }

  const supabase = await createServiceClient();
  const stamp = new Date().toISOString().slice(0, 10);

  if (type === "resumen") {
    let summary;
    try {
      summary = await buildReportesSummary(organization_id);
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "No se pudo generar el resumen" },
        { status: 500 },
      );
    }

    const csv = rowsToCsv(
      ["Categoría", "Indicador", "Cantidad"],
      [
        ["Pacientes", "Total registrados", summary.pacientes.total],
        ["Pacientes", "Triaje Verde", summary.pacientes.triaje.Verde],
        ["Pacientes", "Triaje Amarillo", summary.pacientes.triaje.Amarillo],
        ["Pacientes", "Triaje Rojo", summary.pacientes.triaje.Rojo],
        ["Pacientes", "Estado Triaje", summary.pacientes.estados.Triaje],
        ["Pacientes", "En Atención", summary.pacientes.estados["En Atención"]],
        ["Pacientes", "Hospitalizado", summary.pacientes.estados.Hospitalizado],
        ["Pacientes", "Transferido", summary.pacientes.estados.Transferido],
        ["Pacientes", "Alta Médica", summary.pacientes.estados["Alta Médica"]],
        ["Pacientes", "Anulado", summary.pacientes.estados.Anulado],
        ["Desaparecidos", "Total registrados", summary.desaparecidos.total],
        ["Desaparecidos", "Desaparecidos (en búsqueda)", summary.desaparecidos.desaparecidos],
        ["Desaparecidos", "Encontrados", summary.desaparecidos.encontrados],
        ["Desaparecidos", "Confirmados fallecidos", summary.desaparecidos.fallecidos],
      ],
    );
    return csvResponse(csv, `reporte-resumen-${stamp}.csv`);
  }

  if (type === "pacientes") {
    const { data, error } = await supabase
      .from("catastrophe_victims")
      .select(
        "registration_number, nombre_completo, cedula, edad, genero, telefono_contacto, sector_comunidad, nombre_edificio_casa, numero_apartamento_casa, ubicacion_actual_refugio, notas, created_at, catastrophe_victim_info(triage_category, estado_destino, motivo_principal_consulta, condiciones_preexistentes, alergias, tratamiento_medicamentos, fecha_hora_entrada)",
      )
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: false });

    if (error) return Response.json({ error: error.message }, { status: 500 });

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

    return csvResponse(rowsToCsv(headers, rows), `pacientes-${stamp}.csv`);
  }

  const estadoByType: Record<string, MissingPersonStatus> = {
    desaparecidos: "Desaparecido",
    encontrados: "Encontrado",
    fallecidos: "Confirmado Fallecido",
  };

  const estado = estadoByType[type];

  if (type === "fallecidos") {
    const { data, error } = await scopeMissingPersonsByOrg(
      supabase
        .from("missing_persons")
        .select(
          "nombre, apellido, cedula, edad_aproximada, genero, motivo_fallecimiento, fallecimiento_confirmado, informacion_adicional, estado, contacto_nombre, contacto_apellido, contacto_correo, contacto_telefono_nacional, contacto_telefono_internacional, created_at, updated_at",
        )
        .eq("estado", estado)
        .order("created_at", { ascending: false }),
      organization_id,
    );

    if (error) return Response.json({ error: error.message }, { status: 500 });

    const headers = [
      "Nombre",
      "Apellido",
      "Cédula",
      "Edad aprox.",
      "Género",
      "Motivo fallecimiento",
      "Confirmado sobre desaparición previa",
      "Información adicional",
      "Estado",
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
      p.estado,
      p.contacto_nombre,
      p.contacto_apellido,
      p.contacto_correo,
      p.contacto_telefono_nacional,
      p.contacto_telefono_internacional,
      formatDate(p.created_at),
      formatDate(p.updated_at),
    ]);

    return csvResponse(rowsToCsv(headers, rows), `fallecidos-${stamp}.csv`);
  }

  const { data, error } = await scopeMissingPersonsByOrg(
    supabase
      .from("missing_persons")
      .select(
        "nombre, apellido, cedula, edad_aproximada, genero, ultimo_lugar_visto, informacion_adicional, estado, contacto_nombre, contacto_apellido, contacto_correo, contacto_telefono_nacional, contacto_telefono_internacional, created_at, updated_at",
      )
      .eq("estado", estado)
      .order("created_at", { ascending: false }),
    organization_id,
  );

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const headers = [
    "Nombre",
    "Apellido",
    "Cédula",
    "Edad aprox.",
    "Género",
    "Último lugar visto",
    "Información adicional",
    "Estado",
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
    p.estado,
    p.contacto_nombre,
    p.contacto_apellido,
    p.contacto_correo,
    p.contacto_telefono_nacional,
    p.contacto_telefono_internacional,
    formatDate(p.created_at),
    formatDate(p.updated_at),
  ]);

  const filenameMap: Record<string, string> = {
    desaparecidos: `desaparecidos-${stamp}.csv`,
    encontrados: `encontrados-${stamp}.csv`,
  };

  return csvResponse(rowsToCsv(headers, rows), filenameMap[type]);
}
