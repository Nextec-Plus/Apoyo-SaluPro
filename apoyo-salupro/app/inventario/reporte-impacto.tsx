"use client";

import { ChartCard, HBarChart, VBarMulti, DonutChart, GroupedBars } from "./reportes-charts";
import { CHART, type ReportData } from "./reportes-types";

/* ── KPI card ─────────────────────────────────────────────────────────────── */
function Kpi({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "good" | "bad" | "warn";
}) {
  const toneCls = {
    default: "text-gray-900",
    good: "text-primary",
    bad: "text-crisis",
    warn: "text-amber-600",
  }[tone];
  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`font-display text-2xl font-extrabold tabular-nums mt-1 ${toneCls}`}>{value}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

export function ReporteImpacto({ data, onVerMapa }: { data: ReportData; onVerMapa: () => void }) {
  const k = data.kpis;
  const geoCount = data.solicitudes.geo.length;

  return (
    <div className="space-y-8">
      {/* ── Resumen ejecutivo ─────────────────────────────────────────── */}
      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">
          Resumen ejecutivo
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi label="Artículos activos" value={k.activeItems} hint={`${k.itemsConStock} con stock`} />
          <Kpi label="Stock total" value={k.totalStock} hint="unidades" />
          <Kpi label="Entradas" value={k.entradasUnidades} hint={`${k.entradasCount} movim.`} tone="good" />
          <Kpi label="Salidas" value={k.salidasUnidades} hint={`${k.salidasCount} movim.`} tone="warn" />
          <Kpi
            label="Balance neto"
            value={`${k.balanceNeto >= 0 ? "+" : ""}${k.balanceNeto}`}
            hint="entradas − salidas"
            tone={k.balanceNeto >= 0 ? "good" : "bad"}
          />
          <Kpi label="Solicitudes pend." value={k.solicitudesPendientes} hint={`${k.solicitudesTotal} en total`} tone={k.solicitudesPendientes > 0 ? "warn" : "default"} />
        </div>
      </section>

      {/* ── Ayuda distribuida ─────────────────────────────────────────── */}
      <section>
        <div className="mb-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
            Ayuda distribuida
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Qué entregamos y a dónde · {k.salidasUnidades} unidades en {k.salidasCount} salidas</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Total entregado por destinatario"
            subtitle="Ranking de unidades despachadas"
            empty={data.distribucion.porDestinatario.length === 0}
          >
            <HBarChart data={data.distribucion.porDestinatario.slice(0, 10)} unit="u." />
          </ChartCard>
          <ChartCard
            title="Distribución por categoría"
            subtitle="Qué tipo de insumo sale más"
            empty={data.distribucion.porCategoria.length === 0}
          >
            <VBarMulti data={data.distribucion.porCategoria.slice(0, 12)} />
          </ChartCard>
          <ChartCard
            title="Medios de transporte usados"
            subtitle="Cómo se mueve la ayuda"
            empty={data.distribucion.porMedio.length === 0}
          >
            <DonutChart data={data.distribucion.porMedio} />
          </ChartCard>
          <ChartCard title="Resumen de despacho" subtitle="Indicadores de salida">
            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="font-display text-3xl font-extrabold text-amber-600 tabular-nums">{k.salidasUnidades}</p>
                <p className="text-[11px] text-gray-500 mt-1">unidades entregadas</p>
              </div>
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="font-display text-3xl font-extrabold text-gray-800 tabular-nums">{data.distribucion.porDestinatario.length}</p>
                <p className="text-[11px] text-gray-500 mt-1">destinatarios distintos</p>
              </div>
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="font-display text-3xl font-extrabold text-gray-800 tabular-nums">{k.salidasCount}</p>
                <p className="text-[11px] text-gray-500 mt-1">despachos</p>
              </div>
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="font-display text-3xl font-extrabold text-gray-800 tabular-nums">{data.distribucion.porCategoria.length}</p>
                <p className="text-[11px] text-gray-500 mt-1">categorías movidas</p>
              </div>
            </div>
          </ChartCard>
        </div>
      </section>

      {/* ── Solicitudes vs Inventario ─────────────────────────────────── */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              Solicitudes vs Inventario
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Demanda real de la comunidad frente a lo disponible</p>
          </div>
          <button
            type="button"
            onClick={onVerMapa}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary border border-primary/30 hover:bg-primary-light rounded-lg px-3 py-1.5 transition-colors no-print"
          >
            🗺️ Ver mapa ({geoCount})
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Categorías más solicitadas vs disponibilidad"
            subtitle="Amarillo = demanda · Verde = stock"
            empty={data.solicitudes.vsInventario.length === 0}
          >
            <GroupedBars data={data.solicitudes.vsInventario.slice(0, 10)} />
          </ChartCard>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ChartCard
              title="Por estado"
              subtitle="Pipeline de solicitudes"
              empty={data.solicitudes.porEstado.length === 0}
            >
              <DonutChart data={data.solicitudes.porEstado} height={220} />
            </ChartCard>
            <ChartCard
              title="Por tipo de solicitante"
              subtitle="Quién pide ayuda"
              empty={data.solicitudes.porTipo.length === 0}
            >
              <DonutChart data={data.solicitudes.porTipo} height={220} />
            </ChartCard>
          </div>
        </div>
      </section>

      <p className="text-[11px] text-gray-400 text-center pt-2" style={{ color: CHART.gray }}>
        Datos del período seleccionado · Apoyo SaluPro
      </p>
    </div>
  );
}
