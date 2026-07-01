"use client";

import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
  PieChart, Pie,
} from "recharts";
import { CHART, PALETTE, type LabelValue } from "./reportes-types";

/* ── Contenedor de panel/gráfico ──────────────────────────────────────────── */
export function ChartCard({
  title,
  subtitle,
  children,
  empty,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="mb-4">
        <h4 className="text-sm font-bold text-gray-800">{title}</h4>
        {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {empty ? (
        <p className="text-xs text-gray-400 text-center py-10">Sin datos en el período seleccionado.</p>
      ) : (
        children
      )}
    </div>
  );
}

const tooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
};

/** Acorta etiquetas largas para el eje. */
function trunc(s: string, n = 16) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/* ── Barras horizontales (ranking) ───────────────────────────────────────── */
export function HBarChart({
  data,
  color = CHART.primary,
  height = 260,
  unit = "",
}: {
  data: LabelValue[];
  color?: string;
  height?: number;
  unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#f0f0f0" />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={120}
          tick={{ fontSize: 11, fill: "#4b5563" }}
          tickFormatter={(v: string) => trunc(v)}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}${unit ? " " + unit : ""}`, "Total"] as [string, string]} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={color} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Barras verticales multicolor ────────────────────────────────────────── */
export function VBarMulti({
  data,
  height = 260,
}: {
  data: LabelValue[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#4b5563" }} tickFormatter={(v: string) => trunc(v, 10)} interval={0} angle={-15} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Barras agrupadas (demanda vs oferta) ────────────────────────────────── */
export function GroupedBars({
  data,
  height = 300,
}: {
  data: { label: string; solicitudes: number; stock: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#4b5563" }} tickFormatter={(v: string) => trunc(v, 10)} interval={0} angle={-20} textAnchor="end" height={64} />
        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar name="Solicitudes" dataKey="solicitudes" fill={CHART.amber} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar name="Stock disponible" dataKey="stock" fill={CHART.primary} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Dona ─────────────────────────────────────────────────────────────────── */
export function DonutChart({
  data,
  height = 260,
}: {
  data: LabelValue[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
