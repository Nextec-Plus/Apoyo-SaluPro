import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { drawHorizontalBarChart, drawKpiRow, type BarItem } from "@/lib/reportes/pdf-charts";
import { getSaluProLogoDataUrl } from "@/lib/reportes/pdf-logo";
import type { LabelValue, ReportData } from "@/app/inventario/reportes-types";

/* ────────────────────────────────────────────────────────────────────────────
 * Generador de PDF "espectacular" para los reportes de inventario:
 * portada con logo, KPIs, gráficos de barra y tablas — mismo nivel que el
 * módulo de pacientes/triaje (lib/reportes/pdf.ts).
 * ──────────────────────────────────────────────────────────────────────────── */

const PRIMARY: [number, number, number] = [45, 106, 45];
const PRIMARY_LIGHT: [number, number, number] = [102, 187, 106];
const BLUE: [number, number, number] = [37, 99, 235];
const AMBER: [number, number, number] = [245, 158, 11];
const TEAL: [number, number, number] = [13, 148, 136];
const PURPLE: [number, number, number] = [124, 58, 237];
const RED: [number, number, number] = [198, 40, 40];
const GRAY: [number, number, number] = [156, 163, 175];

const PALETTE: [number, number, number][] = [PRIMARY, BLUE, AMBER, TEAL, PURPLE, RED, PRIMARY_LIGHT, GRAY];

function ensureSpace(doc: jsPDF, y: number, needed: number, margin: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - margin) {
    doc.addPage();
    return margin;
  }
  return y;
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function bars(items: LabelValue[], limit = 8): BarItem[] {
  return items.slice(0, limit).map((it, i) => ({
    label: it.label,
    value: it.value,
    color: PALETTE[i % PALETTE.length],
  }));
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("es-VE", { day: "2-digit", month: "short" }) +
    " " +
    d.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })
  );
}

function drawPdfHeader(doc: jsPDF, title: string, subtitle: string): number {
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();

  // Franja superior de marca.
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 3, "F");

  try {
    doc.addImage(getSaluProLogoDataUrl(), "PNG", margin, 10, 42, 12);
  } catch {
    doc.setFontSize(12);
    doc.setTextColor(...PRIMARY);
    doc.setFont("helvetica", "bold");
    doc.text("Apoyo SaluPro", margin, 18);
  }

  doc.setFontSize(14);
  doc.setTextColor(...PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageW - margin, 16, { align: "right" });
  doc.setFont("helvetica", "normal");

  let y = 28;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(subtitle, margin, y);
  y += 5;

  const generatedAt = new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" });
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generado: ${generatedAt} VET · Centro de Acopio`, margin, y);
  y += 6;

  doc.setDrawColor(45, 106, 45);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  doc.setLineWidth(0.2);
  return y + 7;
}

function drawFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(170, 170, 170);
    doc.text("Apoyo SaluPro · Reporte confidencial de operación interna", 14, pageH - 8);
    doc.text(`Página ${i} de ${pageCount}`, pageW - 14, pageH - 8, { align: "right" });
  }
}

function sectionTitle(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFontSize(11.5);
  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  doc.text(text, x, y);
  doc.setFont("helvetica", "normal");
  return y + 5;
}

function drawAlertTable(
  doc: jsPDF,
  y: number,
  margin: number,
  data: ReportData,
): number {
  const rows = [
    ...data.alertas.enCero.map((i) => ["⚠ AGOTADO", i.presentacion, i.subcategory, "0"]),
    ...data.alertas.bajoUmbral.map((i) => ["Bajo umbral", i.presentacion, i.subcategory, String(i.stock)]),
  ];
  if (rows.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text("✅ No hay faltantes — inventario saludable.", margin, y + 4);
    return y + 12;
  }
  autoTable(doc, {
    startY: y,
    head: [["Estado", "Artículo", "Categoría", "Stock"]],
    body: rows,
    styles: { fontSize: 7.5, cellPadding: 1.8, overflow: "linebreak" },
    headStyles: { fillColor: RED, textColor: 255, fontStyle: "bold" },
    margin: { left: margin, right: margin },
    didParseCell: (d) => {
      if (d.section === "body" && d.row.raw && (d.row.raw as string[])[0] === "⚠ AGOTADO") {
        d.cell.styles.fillColor = [255, 235, 238];
      }
    },
  });
  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  return (finalY ?? y) + 6;
}

function drawMovimientosTable(doc: jsPDF, y: number, margin: number, data: ReportData): number {
  const CAP = 200;
  const movs = data.auditoria.movimientos.slice(0, CAP);
  if (movs.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text("Sin movimientos en el período.", margin, y + 4);
    return y + 12;
  }
  autoTable(doc, {
    startY: y,
    head: [["Fecha", "Tipo", "Artículo", "Categoría", "Cant.", "Operador"]],
    body: movs.map((m) => [
      fmtDateTime(m.created_at),
      m.tipo === "entrada" ? "↓ Entrada" : "↑ Salida",
      cell(m.presentacion),
      cell(m.section),
      (m.tipo === "entrada" ? "+" : "-") + m.cantidad,
      cell(m.operador),
    ]),
    styles: { fontSize: 6.8, cellPadding: 1.4, overflow: "linebreak" },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 250, 247] },
    margin: { left: margin, right: margin },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 1) {
        const isEntrada = (d.cell.raw as string)?.includes("Entrada");
        d.cell.styles.textColor = isEntrada ? PRIMARY : AMBER;
        d.cell.styles.fontStyle = "bold";
      }
    },
  });
  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  let ny = (finalY ?? y) + 4;
  if (data.auditoria.movimientos.length > CAP) {
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Mostrando ${CAP} de ${data.auditoria.movimientos.length} movimientos más recientes.`,
      margin,
      ny,
    );
    ny += 5;
  }
  return ny;
}

/** Genera el PDF completo (impacto + control) del reporte de inventario. */
export function buildInventoryReportPdf(data: ReportData): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  const contentW = doc.internal.pageSize.getWidth() - margin * 2;
  const periodo = `Período: ${fmtDate(data.period.from)} – ${fmtDate(data.period.to)}`;

  /* ── Página(s) 1: Impacto y Operación ──────────────────────────────── */
  let y = drawPdfHeader(doc, "Reporte de Impacto y Operación", periodo);

  y = sectionTitle(doc, "Resumen ejecutivo", margin, y);
  y = drawKpiRow(doc, {
    x: margin,
    y,
    width: contentW,
    items: [
      { label: "Artículos activos", value: data.kpis.activeItems },
      { label: "Stock total", value: data.kpis.totalStock, color: PRIMARY },
      { label: "Entradas (u.)", value: data.kpis.entradasUnidades, color: PRIMARY_LIGHT },
      { label: "Salidas (u.)", value: data.kpis.salidasUnidades, color: AMBER },
      {
        label: "Balance neto",
        value: data.kpis.balanceNeto,
        color: data.kpis.balanceNeto >= 0 ? PRIMARY : RED,
      },
      {
        label: "Solicitudes pend.",
        value: data.kpis.solicitudesPendientes,
        color: data.kpis.solicitudesPendientes > 0 ? AMBER : GRAY,
      },
    ],
  });
  y += 4;

  y = ensureSpace(doc, y, 60, margin);
  y = sectionTitle(doc, "Ayuda distribuida", margin, y);
  y = drawHorizontalBarChart(doc, {
    x: margin,
    y,
    width: contentW,
    title: "Total entregado por destinatario",
    items: bars(data.distribucion.porDestinatario),
  });

  y = ensureSpace(doc, y, 60, margin);
  y = drawHorizontalBarChart(doc, {
    x: margin,
    y,
    width: contentW,
    title: "Distribución por categoría",
    items: bars(data.distribucion.porCategoria),
  });

  y = ensureSpace(doc, y, 50, margin);
  y = drawHorizontalBarChart(doc, {
    x: margin,
    y,
    width: contentW,
    title: "Medios de transporte usados",
    items: bars(data.distribucion.porMedio, 6),
  });

  y = ensureSpace(doc, y, 70, margin);
  y = sectionTitle(doc, "Solicitudes de la comunidad", margin, y);
  y = drawHorizontalBarChart(doc, {
    x: margin,
    y,
    width: contentW,
    title: "Por estado",
    items: bars(data.solicitudes.porEstado, 6),
  });

  y = ensureSpace(doc, y, 50, margin);
  y = drawHorizontalBarChart(doc, {
    x: margin,
    y,
    width: contentW,
    title: "Por tipo de solicitante",
    items: bars(data.solicitudes.porTipo, 6),
  });

  /* ── Página 2+: Control y Alertas ─────────────────────────────────── */
  doc.addPage();
  y = drawPdfHeader(doc, "Reporte de Control y Alertas", periodo);

  y = sectionTitle(doc, "Faltantes críticos", margin, y);
  y = drawKpiRow(doc, {
    x: margin,
    y,
    width: contentW,
    items: [
      { label: "Artículos en cero", value: data.alertas.enCero.length, color: RED },
      { label: "Bajo umbral", value: data.alertas.bajoUmbral.length, color: AMBER },
      { label: "Categorías monitoreadas", value: data.alertas.categoriasDesabastecidas.length, color: GRAY },
    ],
  });
  doc.setFontSize(7.5);
  doc.setTextColor(150, 150, 150);
  doc.text(`Umbral de bajo stock: < ${data.period.umbral} unidades`, margin, y);
  y += 6;

  y = ensureSpace(doc, y, 60, margin);
  y = drawHorizontalBarChart(doc, {
    x: margin,
    y,
    width: contentW,
    title: "Stock por categoría (menor primero)",
    items: data.alertas.categoriasDesabastecidas.slice(0, 10).map((it) => ({
      label: it.label,
      value: it.value,
      color: it.value === 0 ? RED : it.value < data.period.umbral * 3 ? AMBER : PRIMARY,
    })),
  });

  y = ensureSpace(doc, y, 30, margin);
  y = sectionTitle(doc, "Artículos a reponer", margin, y);
  y = drawAlertTable(doc, y, margin, data);

  y = ensureSpace(doc, y, 50, margin);
  y = sectionTitle(doc, "Productividad por operador", margin, y);
  if (data.auditoria.productividad.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text("Sin movimientos registrados en el período.", margin, y + 4);
    y += 12;
  } else {
    y = drawHorizontalBarChart(doc, {
      x: margin,
      y,
      width: contentW,
      title: "Movimientos por operador (entradas + salidas)",
      items: data.auditoria.productividad.slice(0, 8).map((p, i) => ({
        label: p.operador,
        value: p.total,
        color: PALETTE[i % PALETTE.length],
      })),
    });
  }

  y = ensureSpace(doc, y, 30, margin);
  y = sectionTitle(doc, "Auditoría · Kardex consolidado", margin, y);
  drawMovimientosTable(doc, y, margin, data);

  drawFooter(doc);
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
