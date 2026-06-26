import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { DESTINOS_ALTA_TRASLADO, DESTINO_OTROS } from "@/lib/catastrophe-destinos";
import type { ExportPayload, ResumenPatientRow } from "@/lib/reportes/export-data";
import { drawColorLegend, drawHorizontalBarChart, drawKpiRow } from "@/lib/reportes/pdf-charts";
import { getSaluProLogoDataUrl } from "@/lib/reportes/pdf-logo";
import { TRIAGE_LEVELS } from "@/lib/triage-levels";
import type { TriageCategory } from "@/lib/types/database";

const PRIMARY: [number, number, number] = [45, 106, 45];
const GREEN: [number, number, number] = [22, 163, 74];
const YELLOW: [number, number, number] = [245, 158, 11];
const RED: [number, number, number] = [198, 40, 40];
const BLUE: [number, number, number] = [37, 99, 235];
const GRAY: [number, number, number] = [107, 114, 128];

const DESTINO_CHART_COLORS: Record<string, [number, number, number]> = {
  "Dado de alta (Ambulatorio)": GREEN,
  "Referido al Hospital": RED,
  "Trasladado a Refugio Oficial": BLUE,
  [DESTINO_OTROS]: GRAY,
};

function ensureSpace(doc: jsPDF, y: number, needed: number, margin: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - margin) {
    doc.addPage();
    return margin;
  }
  return y;
}

function destinoChartItems(porDestino: Record<string, number>) {
  const items: { label: string; value: number; color: [number, number, number] }[] =
    DESTINOS_ALTA_TRASLADO.map((label) => ({
      label,
      value: porDestino[label] ?? 0,
      color: DESTINO_CHART_COLORS[label] ?? GRAY,
    }));
  if ((porDestino[DESTINO_OTROS] ?? 0) > 0) {
    items.push({
      label: DESTINO_OTROS,
      value: porDestino[DESTINO_OTROS],
      color: GRAY,
    });
  }
  return items;
}

const TRIAGE_ROW_FILL: Record<string, [number, number, number]> = {
  Verde: [232, 245, 233],
  Amarillo: [255, 251, 235],
  Rojo: [255, 235, 238],
};

const TRIAGE_CHART_COLORS: Record<TriageCategory, [number, number, number]> = {
  Verde: GREEN,
  Amarillo: YELLOW,
  Rojo: RED,
};

function triageKpiItems(triaje: Record<TriageCategory, number>) {
  return TRIAGE_LEVELS.map((level) => ({
    label: level.id,
    sub: level.sub,
    value: triaje[level.id],
    color: TRIAGE_CHART_COLORS[level.id],
  }));
}

function triageBarItems(triaje: Record<TriageCategory, number>) {
  return TRIAGE_LEVELS.map((level) => ({
    label: level.barLabel,
    sub: level.sub,
    value: triaje[level.id],
    color: TRIAGE_CHART_COLORS[level.id],
  }));
}

const TRIAGE_LEGEND = TRIAGE_LEVELS.map((level) => ({
  color: TRIAGE_CHART_COLORS[level.id],
  label: level.id,
  description: level.sub,
}));

const MISSING_LEGEND = [
  {
    color: RED,
    label: "Desaparecidos",
    description: "Personas reportadas que aún están en búsqueda.",
  },
  {
    color: GREEN,
    label: "Encontrados",
    description: "Personas localizadas con vida.",
  },
  {
    color: GRAY,
    label: "Fallecidos",
    description: "Fallecimiento confirmado.",
  },
] as const;

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function drawPdfHeader(doc: jsPDF, title: string, subtitle?: string): number {
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();

  try {
    doc.addImage(getSaluProLogoDataUrl(), "PNG", margin, 10, 42, 12);
  } catch {
    doc.setFontSize(12);
    doc.setTextColor(...PRIMARY);
    doc.text("Apoyo SaluPro", margin, 18);
  }

  doc.setFontSize(13);
  doc.setTextColor(...PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageW - margin, 16, { align: "right" });
  doc.setFont("helvetica", "normal");

  let y = 28;
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, margin, y);
    y += 5;
  }

  const generatedAt = new Date().toLocaleString("es-VE", {
    timeZone: "America/Caracas",
  });
  doc.setFontSize(8);
  doc.text(`Generado: ${generatedAt} VET`, margin, y);
  y += 6;

  doc.setDrawColor(229, 231, 235);
  doc.line(margin, y, pageW - margin, y);
  return y + 6;
}

function drawCohortPatientTable(
  doc: jsPDF,
  startY: number,
  margin: number,
  title: string,
  patientList: { headers: string[]; rows: ResumenPatientRow[] },
  colorRows: boolean,
): number {
  const triages = patientList.rows.map((r) => r.triage);

  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  doc.text(title, margin, startY);
  doc.setFont("helvetica", "normal");

  if (patientList.rows.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text("Sin registros.", margin, startY + 6);
    return startY + 12;
  }

  autoTable(doc, {
    startY: startY + 4,
    head: [patientList.headers],
    body: patientList.rows.map((r) => r.cells.map(cell)),
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold" },
    margin: { left: margin, right: margin },
    didParseCell: (data: {
      section: string;
      row: { index: number };
      cell: { styles: { fillColor?: [number, number, number] } };
    }) => {
      if (!colorRows || data.section !== "body") return;
      const triage = triages[data.row.index];
      if (triage && TRIAGE_ROW_FILL[triage]) {
        data.cell.styles.fillColor = TRIAGE_ROW_FILL[triage];
      }
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY;
  return (finalY ?? startY) + 6;
}

function drawCohortCharts(
  doc: jsPDF,
  y: number,
  margin: number,
  contentW: number,
  summary: NonNullable<ExportPayload["summary"]>,
): number {
  const obs = summary.pacientes.en_observacion;

  y = drawKpiRow(doc, {
    x: margin,
    y,
    width: contentW,
    items: triageKpiItems(obs.triaje),
  });

  y = drawHorizontalBarChart(doc, {
    x: margin,
    y,
    width: contentW,
    title: "En observación — distribución por triaje",
    items: triageBarItems(obs.triaje),
  });

  y = drawHorizontalBarChart(doc, {
    x: margin,
    y,
    width: contentW,
    title: "Dados de alta / traslados — distribución por destino",
    items: destinoChartItems(summary.pacientes.dados_alta_traslado.por_destino),
  });

  return y + 2;
}

function buildResumenPdf(payload: ExportPayload): Buffer {
  const summary = payload.summary!;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  const contentW = doc.internal.pageSize.getWidth() - margin * 2;

  let y = drawPdfHeader(doc, payload.title, payload.subtitle);

  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  doc.text("Pacientes registrados", margin, y);
  doc.setFont("helvetica", "normal");
  y += 4;

  y = drawKpiRow(doc, {
    x: margin,
    y,
    width: contentW,
    items: [
      { label: "Total", value: summary.pacientes.total },
      {
        label: "En observación",
        value: summary.pacientes.en_observacion.total,
        color: PRIMARY,
      },
    ],
  });

  y = ensureSpace(doc, y, 50, margin);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("En observación — triaje activo", margin, y);
  doc.setFont("helvetica", "normal");
  y += 4;

  y = drawKpiRow(doc, {
    x: margin,
    y,
    width: contentW,
    items: triageKpiItems(summary.pacientes.en_observacion.triaje),
  });

  y = drawHorizontalBarChart(doc, {
    x: margin,
    y,
    width: contentW,
    title: "Distribución por triaje (en observación)",
    items: triageBarItems(summary.pacientes.en_observacion.triaje),
  });

  y = drawColorLegend(doc, {
    x: margin,
    y,
    width: contentW,
    title: "Leyenda de colores — Triaje clínico",
    items: [...TRIAGE_LEGEND],
  });

  y = ensureSpace(doc, y, 40, margin);
  if (payload.observationPatientList) {
    y = drawCohortPatientTable(
      doc,
      y,
      margin,
      "Pacientes en observación",
      payload.observationPatientList,
      true,
    );
  }

  y = ensureSpace(doc, y, 50, margin);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Dados de alta y traslados", margin, y);
  doc.setFont("helvetica", "normal");
  y += 4;

  const destinoItems = destinoChartItems(
    summary.pacientes.dados_alta_traslado.por_destino,
  );
  y = drawKpiRow(doc, {
    x: margin,
    y,
    width: contentW,
    items: destinoItems.map((item) => ({
      label: item.label.length > 18 ? `${item.label.slice(0, 16)}…` : item.label,
      value: item.value,
      color: item.color,
    })),
  });

  y = drawHorizontalBarChart(doc, {
    x: margin,
    y,
    width: contentW,
    title: "Distribución por destino",
    items: destinoItems,
  });

  y = ensureSpace(doc, y, 40, margin);
  if (payload.dischargedPatientList) {
    y = drawCohortPatientTable(
      doc,
      y,
      margin,
      "Pacientes dados de alta / trasladados",
      payload.dischargedPatientList,
      false,
    );
  }

  y = ensureSpace(doc, y, 60, margin);
  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  doc.text("Personas desaparecidas", margin, y);
  doc.setFont("helvetica", "normal");
  y += 4;

  y = drawKpiRow(doc, {
    x: margin,
    y,
    width: contentW,
    items: [
      { label: "Total registrados", value: summary.desaparecidos.total },
      { label: "Desaparecidos", value: summary.desaparecidos.desaparecidos, color: RED },
      { label: "Encontrados", value: summary.desaparecidos.encontrados, color: GREEN },
      { label: "Fallecidos", value: summary.desaparecidos.fallecidos, color: GRAY },
    ],
  });

  y = drawHorizontalBarChart(doc, {
    x: margin,
    y,
    width: contentW,
    title: "Distribución por estado",
    items: [
      { label: "Desaparecidos", value: summary.desaparecidos.desaparecidos, color: RED },
      { label: "Encontrados", value: summary.desaparecidos.encontrados, color: GREEN },
      { label: "Fallecidos", value: summary.desaparecidos.fallecidos, color: GRAY },
    ],
  });

  drawColorLegend(doc, {
    x: margin,
    y,
    width: contentW,
    title: "Leyenda de colores — Personas desaparecidas",
    items: [...MISSING_LEGEND],
  });

  return Buffer.from(doc.output("arraybuffer"));
}

function buildTablePdf(payload: ExportPayload): Buffer {
  const doc = new jsPDF({
    orientation: payload.headers.length > 5 ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  const margin = 14;
  const contentW = doc.internal.pageSize.getWidth() - margin * 2;
  let y = drawPdfHeader(doc, payload.title, payload.subtitle);

  if (payload.exportType === "pacientes" && payload.summary) {
    y = drawCohortCharts(doc, y, margin, contentW, payload.summary);
    y = drawColorLegend(doc, {
      x: margin,
      y,
      width: contentW,
      title: "Leyenda de colores — Triaje clínico",
      items: [...TRIAGE_LEGEND],
    });
    y += 2;
  }

  autoTable(doc, {
    startY: y,
    head: [payload.headers],
    body: payload.rows.map((row) => row.map(cell)),
    styles: {
      fontSize: payload.headers.length > 12 ? 5 : payload.headers.length > 8 ? 6 : 7,
      cellPadding: 1.2,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: PRIMARY,
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: margin, right: margin },
  });

  return Buffer.from(doc.output("arraybuffer"));
}

/** Genera PDF con logo SaluPro; resumen incluye gráficos de barras. */
export function buildReportPdf(payload: ExportPayload): Buffer {
  if (payload.exportType === "resumen" && payload.summary) {
    return buildResumenPdf(payload);
  }
  return buildTablePdf(payload);
}

export function pdfResponse(body: Buffer, filename: string): Response {
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
