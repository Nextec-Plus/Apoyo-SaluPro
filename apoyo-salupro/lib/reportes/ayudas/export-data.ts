import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { getAyudasRangeUtcBounds } from "@/lib/reportes/ayudas/date-bounds";

export type AyudasReporteSummary = {
  totalEntregas: number;
  totalPersonasUnicas: number;
  porTipo: { nombre: string; cantidad: number }[];
  porDia: { fecha: string; cantidad: number }[];
};

export type AyudasReportePayload = {
  title: string;
  subtitle: string;
  filenameBase: string;
  headers: string[];
  rows: unknown[][];
  summary: AyudasReporteSummary;
};

type ItemRow = {
  cantidad: number;
  ayuda_tipos: { id: string; nombre: string } | { id: string; nombre: string }[] | null;
};

type EntregaRow = {
  id: string;
  cedula: string;
  nombre_completo: string;
  created_at: string;
  ayuda_entrega_items: ItemRow[];
};

function tipoNombre(t: ItemRow["ayuda_tipos"]): string {
  if (!t) return "—";
  const one = Array.isArray(t) ? t[0] : t;
  return one?.nombre ?? "—";
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-VE", { timeZone: "America/Caracas" });
}

function fechaVetOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(new Date(iso));
}

function addDaysVet(fechaVet: string, days: number): string {
  const [y, m, d] = fechaVet.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const HEADERS = ["Cédula", "Nombre completo", "Ayudas entregadas", "Fecha/hora"];

export async function buildAyudasReportePayload(
  organizationId: string,
  supabase: SupabaseClient<Database>,
  startVet: string,
  endVet: string,
): Promise<AyudasReportePayload> {
  const { startUtc, endUtc } = getAyudasRangeUtcBounds(startVet, endVet);

  const data: EntregaRow[] = [];
  const PAGE = 500;
  for (let from = 0; ; from += PAGE) {
    const page = await supabase
      .from("ayuda_entregas")
      .select("id, cedula, nombre_completo, created_at, ayuda_entrega_items(cantidad, ayuda_tipos(id, nombre))")
      .eq("organization_id", organizationId)
      .gte("created_at", startUtc)
      .lt("created_at", endUtc)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (page.error) throw new Error(page.error.message);
    if (!page.data || page.data.length === 0) break;
    data.push(...(page.data as unknown as EntregaRow[]));
    if (page.data.length < PAGE) break;
  }

  const rows = data.map((entrega) => [
    entrega.cedula,
    entrega.nombre_completo,
    entrega.ayuda_entrega_items
      .map((it) => `${it.cantidad}× ${tipoNombre(it.ayuda_tipos)}`)
      .join(" · "),
    fmtFecha(entrega.created_at),
  ]);

  const porTipoMap = new Map<string, number>();
  const cedulasUnicas = new Set<string>();
  for (const entrega of data) {
    cedulasUnicas.add(entrega.cedula);
    for (const it of entrega.ayuda_entrega_items) {
      const nombre = tipoNombre(it.ayuda_tipos);
      porTipoMap.set(nombre, (porTipoMap.get(nombre) ?? 0) + it.cantidad);
    }
  }
  const porTipo = [...porTipoMap.entries()]
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

  const porDiaMap = new Map<string, number>();
  for (const entrega of data) {
    const fecha = fechaVetOf(entrega.created_at);
    porDiaMap.set(fecha, (porDiaMap.get(fecha) ?? 0) + 1);
  }
  const porDia: { fecha: string; cantidad: number }[] = [];
  for (let fecha = startVet; fecha <= endVet; fecha = addDaysVet(fecha, 1)) {
    porDia.push({ fecha, cantidad: porDiaMap.get(fecha) ?? 0 });
  }

  const rangoLabel = startVet === endVet ? startVet : `${startVet} a ${endVet}`;

  return {
    title: `Reporte de Ayudas — ${rangoLabel} — Apoyo SaluPro`,
    subtitle: `${rangoLabel} · ${data.length} entrega(s)`,
    filenameBase: `ayudas-${startVet}_${endVet}`,
    headers: HEADERS,
    rows,
    summary: {
      totalEntregas: data.length,
      totalPersonasUnicas: cedulasUnicas.size,
      porTipo,
      porDia,
    },
  };
}
