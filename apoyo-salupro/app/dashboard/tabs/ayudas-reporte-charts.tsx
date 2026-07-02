"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const AYUDAS_CATEGORICAL_PALETTE = [
  "#2a78d6",
  "#1baf7a",
  "#eda100",
  "#008300",
  "#4a3aa7",
  "#e34948",
  "#e87ba4",
  "#eb6834",
] as const;

export const AYUDAS_OTROS_COLOR = "#898781";

export type PorTipoEntry = { nombre: string; cantidad: number };
export type PorDiaEntry = { fecha: string; cantidad: number };

function colorForIndex(i: number): string {
  return i < AYUDAS_CATEGORICAL_PALETTE.length ? AYUDAS_CATEGORICAL_PALETTE[i] : AYUDAS_OTROS_COLOR;
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-xs text-gray-400 py-6 text-center">{text}</p>;
}

export function TiposBarChart({ porTipo }: { porTipo: PorTipoEntry[] }) {
  if (porTipo.length === 0) return <EmptyState text="Sin ayudas registradas en este rango." />;

  const rowH = 28;
  const height = Math.max(120, porTipo.length * rowH);

  return (
    <div className={porTipo.length > 10 ? "max-h-[320px] overflow-y-auto pr-1" : ""}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={porTipo} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="#e5e7eb" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#898781" }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="nombre"
            width={140}
            tick={{ fontSize: 11, fill: "#374151" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => [Number(value).toLocaleString("es-VE"), "Cantidad"]}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e5e7eb" }}
          />
          <Bar dataKey="cantidad" radius={[0, 4, 4, 0]} barSize={16}>
            {porTipo.map((entry, i) => (
              <Cell key={entry.nombre} fill={colorForIndex(i)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TiposPieChart({ porTipo }: { porTipo: PorTipoEntry[] }) {
  if (porTipo.length === 0) return <EmptyState text="Sin ayudas registradas en este rango." />;

  const top = porTipo.slice(0, 8);
  const restoTotal = porTipo.slice(8).reduce((sum, t) => sum + t.cantidad, 0);
  const slices = restoTotal > 0 ? [...top, { nombre: "Otros", cantidad: restoTotal }] : top;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="cantidad"
          nameKey="nombre"
          cx="50%"
          cy="45%"
          outerRadius={80}
          label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`}
          labelLine={false}
        >
          {slices.map((entry, i) => (
            <Cell
              key={entry.nombre}
              fill={i < top.length ? colorForIndex(i) : AYUDAS_OTROS_COLOR}
            />
          ))}
        </Pie>
        <Tooltip formatter={(value, _name, item) => [Number(value).toLocaleString("es-VE"), item.payload.nombre]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function PersonasPorDiaChart({ porDia }: { porDia: PorDiaEntry[] }) {
  if (porDia.every((d) => d.cantidad === 0)) return <EmptyState text="Sin entregas registradas en este rango." />;

  const data = porDia.map((d) => ({
    ...d,
    label: new Date(`${d.fecha}T12:00:00`).toLocaleDateString("es-VE", { day: "2-digit", month: "short" }),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#898781" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#898781" }} axisLine={false} tickLine={false} width={28} />
        <Tooltip
          formatter={(value) => [Number(value).toLocaleString("es-VE"), "Entregas"]}
          labelFormatter={(_label, payload) => payload?.[0]?.payload?.fecha ?? ""}
          contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e5e7eb" }}
        />
        <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} fill="#2d6a2d" barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
