"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ReporteImpacto } from "./reporte-impacto";
import { ReporteControl } from "./reporte-control";
import { MapaCalorDynamic } from "./mapa-calor-dynamic";
import { SaluproLoader } from "./salupro-loader";
import type { ReportData } from "./reportes-types";

type ReportView = "impacto" | "control" | "mapa";

/* Presets de período rápido. */
const PRESETS: { id: string; label: string; days: number | "all" }[] = [
  { id: "1", label: "1 día", days: 1 },
  { id: "7", label: "7 días", days: 7 },
  { id: "30", label: "30 días", days: 30 },
  { id: "90", label: "90 días", days: 90 },
  { id: "all", label: "Todo", days: "all" },
];

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function TabReportes() {
  const [view, setView] = useState<ReportView>("impacto");
  const [preset, setPreset] = useState("30");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const range = useMemo(() => {
    const p = PRESETS.find((x) => x.id === preset)!;
    const to = new Date().toISOString();
    const from = p.days === "all" ? new Date("2020-01-01").toISOString() : isoDaysAgo(p.days);
    return { from, to };
  }, [preset]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to });
      const res = await fetch(`/api/inventory/reports?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "No se pudo generar el reporte");
      setData(json as ReportData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const handleExport = () => {
    if (typeof window !== "undefined") window.print();
  };

  const views: { v: ReportView; label: string; icon: string }[] = [
    { v: "impacto", label: "Impacto y Operación", icon: "📈" },
    { v: "control", label: "Control y Alertas", icon: "🚨" },
  ];

  const puntos = (data?.solicitudes.geo ?? []).map((g) => ({ lat: g.lat, lng: g.lng, weight: 1 }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-6">
      {/* ── Cabecera ───────────────────────────────────────────────────── */}
      <div className="border-b border-border pb-3 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Reportes</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Estadísticas y métricas para stakeholders
          </p>
        </div>
        <div className="flex items-center gap-2 no-print">
          {/* Exportar PDF */}
          <button
            type="button"
            onClick={handleExport}
            disabled={loading || !!error}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary-dark rounded-lg px-3.5 py-2 transition-colors disabled:opacity-50 shadow-sm shadow-primary/20"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
            </svg>
            Exportar PDF
          </button>
          {/* Período */}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                  preset === p.id ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="text-xs font-semibold text-gray-500 hover:text-primary border border-border rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            ↻
          </button>
        </div>
      </div>

      {/* ── Título solo para impresión/PDF ────────────────────────────── */}
      <div className="print-only mb-4">
        <h1 className="text-xl font-bold text-gray-900">
          Apoyo SaluPro · {view === "impacto" ? "Reporte de Impacto y Operación" : "Reporte de Control y Alertas"}
        </h1>
        <p className="text-xs text-gray-500">
          Período: {new Date(range.from).toLocaleDateString("es-VE")} – {new Date(range.to).toLocaleDateString("es-VE")}
          {" · "}Generado: {new Date().toLocaleString("es-VE")}
        </p>
      </div>

      {view === "mapa" ? (
        /* ── Vista dedicada: Mapa de calor ──────────────────────────── */
        <div className="no-print">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setView("impacto")}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900 border border-border rounded-lg px-3 py-1.5 transition-colors"
              >
                ← Volver
              </button>
              <div>
                <h3 className="text-base font-bold text-gray-800">Mapa de calor · Solicitudes</h3>
                <p className="text-[11px] text-gray-400">
                  Densidad geográfica de solicitudes con GPS · usa los controles del mapa para 2D/3D, satélite y zonas
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold rounded-full bg-primary-light text-primary-dark px-3 py-1.5">
              {puntos.length} punto{puntos.length !== 1 ? "s" : ""}
            </span>
          </div>

          {puntos.length === 0 && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
              No hay solicitudes con ubicación GPS en este período. El mapa y sus filtros siguen disponibles para explorar.
            </div>
          )}

          <div className="h-[68vh] min-h-[460px] w-full rounded-xl border border-border overflow-hidden">
            <MapaCalorDynamic puntos={puntos} />
          </div>
        </div>
      ) : (
        <>
          {/* ── Sub-nav de reportes ─────────────────────────────────── */}
          <div className="flex flex-wrap gap-2 mb-6 no-print">
            {views.map((vw) => (
              <button
                key={vw.v}
                type="button"
                onClick={() => setView(vw.v)}
                className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border transition-colors ${
                  view === vw.v
                    ? "border-primary bg-primary-light text-primary-dark"
                    : "border-border bg-white text-gray-600 hover:border-primary/40"
                }`}
              >
                <span>{vw.icon}</span>
                {vw.label}
              </button>
            ))}
          </div>

          {/* ── Contenido ───────────────────────────────────────────── */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <SaluproLoader size={80} text="Generando reporte…" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-crisis/30 bg-crisis-light text-crisis text-sm px-4 py-4 flex items-center justify-between gap-3">
              <span>{error}</span>
              <button onClick={load} className="text-xs font-bold underline shrink-0">Reintentar</button>
            </div>
          ) : data ? (
            view === "impacto"
              ? <ReporteImpacto data={data} onVerMapa={() => setView("mapa")} />
              : <ReporteControl data={data} />
          ) : null}
        </>
      )}
    </div>
  );
}
