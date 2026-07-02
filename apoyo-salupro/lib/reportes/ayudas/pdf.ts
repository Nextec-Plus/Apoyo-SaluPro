import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { AyudasReportePayload } from "@/lib/reportes/ayudas/export-data";
import { getSaluProLogoDataUrl } from "@/lib/reportes/pdf-logo";
import { drawHorizontalBarChart } from "@/lib/reportes/pdf-charts";

const PRIMARY: [number, number, number] = [45, 106, 45];

const CHART_PALETTE: [number, number, number][] = [
  [42, 120, 214], // #2a78d6
  [27, 175, 122], // #1baf7a
  [237, 161, 0],  // #eda100
  [0, 131, 0],    // #008300
  [74, 58, 167],  // #4a3aa7
  [227, 73, 72],  // #e34948
  [232, 123, 164],// #e87ba4
  [235, 104, 52], // #eb6834
];
const CHART_OTROS: [number, number, number] = [137, 135, 129]; // #898781

function colorForIndex(i: number): [number, number, number] {
  return i < CHART_PALETTE.length ? CHART_PALETTE[i] : CHART_OTROS;
}

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
  doc.text(title, pageW - margin, 16, { align: "right", maxWidth: pageW - margin * 2 - 45 });
  doc.setFont("helvetica", "normal");

  let y = 28;
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, margin, y);
    y += 5;
  }

  const generatedAt = new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" });
  doc.setFontSize(8);
  doc.text(`Generado: ${generatedAt} VET`, margin, y);
  y += 6;

  doc.setDrawColor(229, 231, 235);
  doc.line(margin, y, pageW - margin, y);
  return y + 6;
}

function drawSummary(doc: jsPDF, summary: AyudasReportePayload["summary"], startY: number): number {
  const margin = 14;
  let y = startY;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY);
  doc.text("Resumen del período", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Total entregas: ${summary.totalEntregas}`, margin, y);
  doc.text(`Personas únicas atendidas: ${summary.totalPersonasUnicas}`, margin + 80, y);
  y += 8;

  if (summary.porTipo.length > 0) {
    y = drawHorizontalBarChart(doc, {
      x: margin,
      y,
      width: doc.internal.pageSize.getWidth() - margin * 2,
      title: "Ayudas por tipo",
      items: summary.porTipo.map((t, i) => ({
        label: t.nombre,
        value: t.cantidad,
        color: colorForIndex(i),
      })),
    });
    y += 4;
  }

  return y;
}

export function buildAyudasReportePdf(payload: AyudasReportePayload): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const margin = 14;
  let y = drawPdfHeader(doc, payload.title, payload.subtitle);
  y = drawSummary(doc, payload.summary, y);

  autoTable(doc, {
    startY: y,
    head: [payload.headers],
    body: payload.rows.map((row) => row.map(cell)),
    styles: { fontSize: 8, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: margin, right: margin },
  });

  return Buffer.from(doc.output("arraybuffer"));
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
