import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ExportPayload, ResumenPatientRow } from "@/lib/reportes/export-data";
import { drawColorLegend, drawHorizontalBarChart, drawKpiRow } from "@/lib/reportes/pdf-charts";
import { getSaluProLogoDataUrl } from "@/lib/reportes/pdf-logo";

const PRIMARY: [number, number, number] = [45, 106, 45];
const GREEN: [number, number, number] = [22, 163, 74];
const YELLOW: [number, number, number] = [245, 158, 11];
const RED: [number, number, number] = [198, 40, 40];
const GRAY: [number, number, number] = [107, 114, 128];

const TRIAGE_ROW_FILL: Record<string, [number, number, number]> = {
  Verde: [232, 245, 233],
  Amarillo: [255, 251, 235],
  Rojo: [255, 235, 238],
};

const TRIAGE_LEGEND = [
  {
    color: GREEN,
    label: "Verde",
    description: "Leve / ambulatorio — puede continuar con seguimiento ambulatorio.",
  },
  {
    color: YELLOW,
    label: "Amarillo",
    description: "Moderado / en observación — requiere vigilancia clínica.",
  },
  {
    color: RED,
    label: "Rojo",
    description: "Grave / emergencia inmediata — atención urgente.",
  },
] as const;

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

function drawPatientListTable(
  doc: jsPDF,
  startY: number,
  margin: number,
  patientList: NonNullable<ExportPayload["patientList"]>,
) {
  const triages = patientList.rows.map((r) => r.triage);

  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  doc.text("Listado de pacientes", margin, startY);
  doc.setFont("helvetica", "normal");

  autoTable(doc, {
    startY: startY + 4,
    head: [patientList.headers],
    body: patientList.rows.map((r: ResumenPatientRow) => r.cells.map(cell)),
    styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 32 },
      3: { cellWidth: 35 },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const triage = triages[data.row.index];
      if (triage && TRIAGE_ROW_FILL[triage]) {
        data.cell.styles.fillColor = TRIAGE_ROW_FILL[triage];
      }
    },
  });
}

function buildResumenPdf(payload: ExportPayload): Buffer {
  const summary = payload.summary!;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  const contentW = doc.internal.pageSize.getWidth() - margin * 2;

  let y = drawPdfHeader(doc, payload.title, payload.subtitle);

  // ── Pacientes ───────────────────────────────────────────────────────────
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
      { label: "Verde", value: summary.pacientes.triaje.Verde, color: GREEN },
      { label: "Amarillo", value: summary.pacientes.triaje.Amarillo, color: YELLOW },
      { label: "Rojo", value: summary.pacientes.triaje.Rojo, color: RED },
    ],
  });

  y = drawHorizontalBarChart(doc, {
    x: margin,
    y,
    width: contentW,
    title: "Distribución por triaje",
    items: [
      { label: "Verde", value: summary.pacientes.triaje.Verde, color: GREEN },
      { label: "Amarillo", value: summary.pacientes.triaje.Amarillo, color: YELLOW },
      { label: "Rojo", value: summary.pacientes.triaje.Rojo, color: RED },
    ],
  });

  y = drawColorLegend(doc, {
    x: margin,
    y,
    width: contentW,
    title: "Leyenda de colores — Triaje clínico",
    items: [...TRIAGE_LEGEND],
  });

  y += 4;

  // ── Desaparecidos ───────────────────────────────────────────────────────
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

  y = drawColorLegend(doc, {
    x: margin,
    y,
    width: contentW,
    title: "Leyenda de colores — Personas desaparecidas",
    items: [...MISSING_LEGEND],
  });

  y += 6;

  // ── Listado de pacientes (reemplaza tabla Sección/Indicador/Cantidad) ─────
  if (payload.patientList && payload.patientList.rows.length > 0) {
    drawPatientListTable(doc, y, margin, payload.patientList);
  } else if (payload.patientList) {
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text("Listado de pacientes: sin registros.", margin, y);
  }

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

  if (payload.exportType === "pacientes") {
    const triajeIdx = payload.headers.indexOf("Triaje");
    const counts = { Verde: 0, Amarillo: 0, Rojo: 0 };
    if (triajeIdx >= 0) {
      for (const row of payload.rows) {
        const t = String(row[triajeIdx] ?? "");
        if (t in counts) counts[t as keyof typeof counts]++;
      }
    }
    y = drawHorizontalBarChart(doc, {
      x: margin,
      y,
      width: contentW,
      title: "Distribución por triaje",
      items: [
        { label: "Verde", value: counts.Verde, color: GREEN },
        { label: "Amarillo", value: counts.Amarillo, color: YELLOW },
        { label: "Rojo", value: counts.Rojo, color: RED },
      ],
    });
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
