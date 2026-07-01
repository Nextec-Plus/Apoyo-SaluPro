"use client";

import { useMemo, useState } from "react";
import { ChartCard, HBarChart } from "./reportes-charts";
import { CHART, type ReportData } from "./reportes-types";

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("es-VE", { day: "2-digit", month: "short" }) +
    " " +
    d.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })
  );
}

export function ReporteControl({ data }: { data: ReportData }) {
  const { enCero, bajoUmbral, categoriasDesabastecidas } = data.alertas;
  const umbral = data.period.umbral;

  /* ── Filtros de auditoría ──────────────────────────────────────────── */
  const [fSection, setFSection] = useState("");
  const [fOperador, setFOperador] = useState("");
  const [fTipo, setFTipo] = useState<"" | "entrada" | "salida">("");

  const sectionOpts = useMemo(
    () => [...new Set(data.auditoria.movimientos.map((m) => m.section))].sort(),
    [data.auditoria.movimientos],
  );
  const operadorOpts = useMemo(
    () => [...new Set(data.auditoria.movimientos.map((m) => m.operador))].sort(),
    [data.auditoria.movimientos],
  );

  const movFiltrados = useMemo(
    () =>
      data.auditoria.movimientos.filter(
        (m) =>
          (!fSection || m.section === fSection) &&
          (!fOperador || m.operador === fOperador) &&
          (!fTipo || m.tipo === fTipo),
      ),
    [data.auditoria.movimientos, fSection, fOperador, fTipo],
  );

  const prodData = data.auditoria.productividad.map((p) => ({ label: p.operador, value: p.total }));

  const selectCls =
    "text-xs bg-white border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-ring text-gray-700";

  return (
    <div className="space-y-8">
      {/* ── Faltantes críticos ────────────────────────────────────────── */}
      <section>
        <div className="mb-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
            Faltantes críticos
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Accionable: dispara nuevas campañas de donación · umbral bajo stock: &lt; {umbral}
          </p>
        </div>

        {/* Contadores */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl border border-crisis/20 bg-crisis-light/40 p-4">
            <p className="font-display text-3xl font-extrabold text-crisis tabular-nums">{enCero.length}</p>
            <p className="text-[11px] font-semibold text-crisis/80 mt-1">Artículos en CERO</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-display text-3xl font-extrabold text-amber-600 tabular-nums">{bajoUmbral.length}</p>
            <p className="text-[11px] font-semibold text-amber-700 mt-1">Bajo umbral (&lt; {umbral})</p>
          </div>
          <div className="rounded-xl border border-border bg-muted p-4">
            <p className="font-display text-3xl font-extrabold text-gray-800 tabular-nums">{categoriasDesabastecidas.length}</p>
            <p className="text-[11px] font-semibold text-gray-500 mt-1">Categorías monitoreadas</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Tabla de faltantes */}
          <div className="bg-white rounded-xl border border-border p-5">
            <h4 className="text-sm font-bold text-gray-800 mb-3">Artículos a reponer</h4>
            {enCero.length === 0 && bajoUmbral.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-10">✅ No hay faltantes. Inventario saludable.</p>
            ) : (
              <div className="overflow-x-auto -mx-1 max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-[10px] uppercase tracking-wider text-gray-400 border-b border-border">
                      <th className="py-2 px-1 font-semibold">Artículo</th>
                      <th className="py-2 px-1 font-semibold">Categoría</th>
                      <th className="py-2 px-1 font-semibold text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enCero.map((i) => (
                      <tr key={i.id} className="border-b border-border/60">
                        <td className="py-1.5 px-1 font-medium text-gray-800">{i.presentacion}</td>
                        <td className="py-1.5 px-1 text-gray-500">{i.subcategory}</td>
                        <td className="py-1.5 px-1 text-right">
                          <span className="font-bold text-crisis tabular-nums">0</span>
                        </td>
                      </tr>
                    ))}
                    {bajoUmbral.map((i) => (
                      <tr key={i.id} className="border-b border-border/60">
                        <td className="py-1.5 px-1 font-medium text-gray-800">{i.presentacion}</td>
                        <td className="py-1.5 px-1 text-gray-500">{i.subcategory}</td>
                        <td className="py-1.5 px-1 text-right">
                          <span className="font-bold text-amber-600 tabular-nums">{i.stock}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Stock por categoría */}
          <ChartCard
            title="Stock por categoría"
            subtitle="Menor stock primero = prioridad de reabastecimiento"
            empty={categoriasDesabastecidas.length === 0}
          >
            <HBarChart data={categoriasDesabastecidas.slice(0, 12)} color={CHART.crisis} unit="u." />
          </ChartCard>
        </div>
      </section>

      {/* ── Productividad por operador ────────────────────────────────── */}
      <section>
        <div className="mb-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
            Productividad por operador
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Movimientos registrados por persona · control interno</p>
        </div>
        <ChartCard
          title="Movimientos por operador"
          subtitle="Entradas + salidas en el período"
          empty={prodData.length === 0}
        >
          <HBarChart data={prodData} color={CHART.blue} unit="mov." />
        </ChartCard>
      </section>

      {/* ── Auditoría / Kardex consolidado ────────────────────────────── */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              Auditoría · Kardex consolidado
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {movFiltrados.length} de {data.auditoria.movimientos.length} movimientos
              {data.auditoria.movimientos.length >= 500 && " (máx. 500 recientes)"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={fTipo} onChange={(e) => setFTipo(e.target.value as "" | "entrada" | "salida")} className={selectCls}>
              <option value="">Todo tipo</option>
              <option value="entrada">Entradas</option>
              <option value="salida">Salidas</option>
            </select>
            <select value={fSection} onChange={(e) => setFSection(e.target.value)} className={selectCls}>
              <option value="">Toda categoría</option>
              {sectionOpts.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={fOperador} onChange={(e) => setFOperador(e.target.value)} className={selectCls}>
              <option value="">Todo operador</option>
              {operadorOpts.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {movFiltrados.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-12">Sin movimientos para los filtros seleccionados.</p>
          ) : (
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full text-xs min-w-[680px]">
                <thead className="sticky top-0 bg-white shadow-sm">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-gray-400 border-b border-border">
                    <th className="py-2.5 px-3 font-semibold">Fecha</th>
                    <th className="py-2.5 px-3 font-semibold">Tipo</th>
                    <th className="py-2.5 px-3 font-semibold">Artículo</th>
                    <th className="py-2.5 px-3 font-semibold">Categoría</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Cant.</th>
                    <th className="py-2.5 px-3 font-semibold">Operador</th>
                    <th className="py-2.5 px-3 font-semibold">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {movFiltrados.map((m) => (
                    <tr key={m.id} className="border-b border-border/60 hover:bg-muted/50">
                      <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{fmtDateTime(m.created_at)}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          m.tipo === "entrada" ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"
                        }`}>
                          {m.tipo === "entrada" ? "↓ Entrada" : "↑ Salida"}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-medium text-gray-800 max-w-[160px] truncate" title={m.presentacion}>{m.presentacion}</td>
                      <td className="py-2 px-3 text-gray-500 max-w-[120px] truncate" title={m.subcategory}>{m.subcategory}</td>
                      <td className={`py-2 px-3 text-right font-bold tabular-nums ${m.tipo === "entrada" ? "text-primary" : "text-amber-700"}`}>
                        {m.tipo === "entrada" ? "+" : "-"}{m.cantidad}
                      </td>
                      <td className="py-2 px-3 text-gray-500 max-w-[140px] truncate" title={m.operador}>{m.operador}</td>
                      <td className="py-2 px-3 text-gray-500 max-w-[180px] truncate" title={m.detalle}>{m.detalle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
