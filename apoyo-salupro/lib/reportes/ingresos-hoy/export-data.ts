import { generoDbToUi } from "@/lib/config";
import { getIngresosHoyUtcBounds } from "@/lib/reportes/ingresos-hoy/date-bounds";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export type IngresosHoyPayload = {
  title: string;
  subtitle: string;
  filenameBase: string;
  headers: string[];
  rows: unknown[][];
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

type IngresosHoyRow = {
  registration_number: string | null;
  nombre_completo: string;
  cedula: string | null;
  edad: number | null;
  genero: string | null;
  telefono_contacto: string | null;
  sector_comunidad: string | null;
  nombre_edificio_casa: string | null;
  numero_apartamento_casa: string | null;
  ubicacion_actual_refugio: string | null;
  notas: string | null;
  created_at: string;
  catastrophe_victim_info: Parameters<typeof victimInfo>[0];
};

const HEADERS = [
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

const INFO_EMBED =
  "catastrophe_victim_info(triage_category, estado_destino, motivo_principal_consulta, condiciones_preexistentes, alergias, tratamiento_medicamentos, fecha_hora_entrada)";

export async function buildIngresosHoyPayload(
  organizationId: string,
  supabase: SupabaseClient<Database>,
  fechaVetOverride?: string,
): Promise<IngresosHoyPayload> {
  const { startUtc, endUtc, fechaVet } = getIngresosHoyUtcBounds(new Date(), fechaVetOverride);

  const data: IngresosHoyRow[] = [];
  const PAGE = 500;
  for (let from = 0; ; from += PAGE) {
    const page = await supabase
      .from("catastrophe_victims")
      .select(
        `registration_number, nombre_completo, cedula, edad, genero, telefono_contacto, sector_comunidad, nombre_edificio_casa, numero_apartamento_casa, ubicacion_actual_refugio, notas, created_at, ${INFO_EMBED}`,
      )
      .eq("organization_id", organizationId)
      .gte("created_at", startUtc)
      .lte("created_at", endUtc)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (page.error) throw new Error(page.error.message);
    if (!page.data || page.data.length === 0) break;
    data.push(...(page.data as unknown as IngresosHoyRow[]));
    if (page.data.length < PAGE) break;
  }

  const rows = data.map((v) => {
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
    title: `Ingresos del ${fechaVet} — Apoyo SaluPro`,
    subtitle: `${fechaVet} · ${rows.length} registro(s)`,
    filenameBase: `ingresos-${fechaVet}`,
    headers: HEADERS,
    rows,
  };
}
