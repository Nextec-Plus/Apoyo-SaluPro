import type { jsPDF } from "jspdf";

export type BarItem = {
  label: string;
  sub?: string;
  value: number;
  color: [number, number, number];
};

/** Barras horizontales con etiqueta y valor. */
export function drawHorizontalBarChart(
  doc: jsPDF,
  opts: {
    x: number;
    y: number;
    width: number;
    title: string;
    items: BarItem[];
  },
): number {
  const { x, y, width, title, items } = opts;
  const labelW = 42;
  const valueW = 14;
  const barAreaW = width - labelW - valueW - 4;
  const barH = 7;
  const gap = 3;
  const rowExtra = items.some((i) => i.sub) ? 4 : 0;
  const max = Math.max(...items.map((i) => i.value), 1);

  doc.setFontSize(10);
  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  doc.text(title, x, y);
  doc.setFont("helvetica", "normal");

  let cy = y + 6;
  for (const item of items) {
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.setFont("helvetica", "bold");
    doc.text(item.label, x, cy + 5);
    if (item.sub) {
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text(item.sub, x, cy + 9);
    }

    const barX = x + labelW;
    const barLen = barAreaW * (item.value / max);
    doc.setFillColor(...item.color);
    if (barLen > 0) {
      doc.roundedRect(barX, cy, barLen, barH, 1, 1, "F");
    }

    doc.setTextColor(31, 41, 55);
    doc.setFont("helvetica", "bold");
    doc.text(item.value.toLocaleString("es-VE"), barX + barAreaW + 2, cy + 5);
    doc.setFont("helvetica", "normal");

    cy += barH + gap + rowExtra;
  }

  return cy + 4;
}

/** Fila de KPIs (número grande + etiqueta). */
export function drawKpiRow(
  doc: jsPDF,
  opts: {
    x: number;
    y: number;
    width: number;
    items: { label: string; sub?: string; value: number; color?: [number, number, number] }[];
  },
): number {
  const { x, y, width, items } = opts;
  const colW = width / items.length;
  const hasSub = items.some((item) => item.sub);
  const labelLineH = 3;
  const innerW = colW - 4; // padding para no tocar la columna vecina

  // Pre-calcular las líneas de cada etiqueta (envueltas, sin truncar) para
  // alinear todas las columnas a la misma altura.
  doc.setFontSize(7);
  const wrapped = items.map((item) =>
    doc.splitTextToSize(item.label.toUpperCase(), innerW) as string[],
  );
  const maxLabelLines = Math.max(1, ...wrapped.map((l) => l.length));

  items.forEach((item, i) => {
    const cx = x + i * colW + colW / 2;
    if (item.color) doc.setTextColor(...item.color);
    else doc.setTextColor(31, 41, 55);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(item.value.toLocaleString("es-VE"), cx, y + 6, { align: "center" });

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(wrapped[i], cx, y + 11, { align: "center" });

    if (item.sub) {
      doc.setFontSize(6);
      doc.text(item.sub, cx, y + 11 + maxLabelLines * labelLineH + 0.5, { align: "center" });
    }
  });

  return y + 11 + maxLabelLines * labelLineH + (hasSub ? 5 : 1);
}

export type LegendItem = {
  color: [number, number, number];
  label: string;
  description: string;
};

/** Leyenda de colores (cuadrado + texto). */
export function drawColorLegend(
  doc: jsPDF,
  opts: {
    x: number;
    y: number;
    width: number;
    title: string;
    items: LegendItem[];
  },
): number {
  const { x, y, width, title, items } = opts;
  const box = 4;

  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.setFont("helvetica", "bold");
  doc.text(title, x, y);
  doc.setFont("helvetica", "normal");

  let cy = y + 5;
  for (const item of items) {
    doc.setFillColor(...item.color);
    doc.roundedRect(x, cy - 3, box, box, 0.5, 0.5, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(31, 41, 55);
    doc.setFont("helvetica", "bold");
    doc.text(item.label, x + box + 2, cy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    const descX = x + box + 2 + doc.getTextWidth(item.label) + 2;
    const maxW = width - (descX - x);
    const lines = doc.splitTextToSize(item.description, maxW);
    doc.text(lines, descX, cy);
    cy += Math.max(5, lines.length * 3.5);
  }

  return cy + 2;
}
