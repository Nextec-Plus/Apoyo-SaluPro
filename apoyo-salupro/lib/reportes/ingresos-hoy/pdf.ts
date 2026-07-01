import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { IngresosHoyPayload } from "@/lib/reportes/ingresos-hoy/export-data";
import { getSaluProLogoDataUrl } from "@/lib/reportes/pdf-logo";

const PRIMARY: [number, number, number] = [45, 106, 45];

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

export function buildIngresosHoyPdf(payload: IngresosHoyPayload): Buffer {
  const doc = new jsPDF({
    orientation: payload.headers.length > 5 ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  const margin = 14;
  const y = drawPdfHeader(doc, payload.title, payload.subtitle);

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

export function pdfResponse(body: Buffer, filename: string): Response {
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
