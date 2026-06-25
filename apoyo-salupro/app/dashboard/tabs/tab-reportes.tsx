"use client";

import { useCallback, useEffect, useState } from "react";
import { getClientOrganizationId } from "@/lib/config";
import type { ReportesSummary } from "@/lib/reportes/summary";
import { useToast } from "@/components/toast-provider";

type ExportType = "resumen" | "pacientes" | "desaparecidos" | "encontrados" | "fallecidos";
type ExportFormat = "csv" | "pdf";
type ExportKey = `${ExportType}:${ExportFormat}`;

function StatCard({
  value,
  label,
  color,
  ring,
  loading,
}: {
  value: number;
  label: string;
  color: string;
  ring: string;
  loading: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-white px-4 py-4 shadow-sm ${ring}`}>
      <div className={`font-display text-2xl sm:text-3xl font-extrabold tabular-nums ${color}`}>
        {loading ? "—" : value.toLocaleString("es-VE")}
      </div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 leading-tight">
        {label}
      </div>
    </div>
  );
}

function TriageBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-semibold text-gray-700">{label}</span>
        <span className="tabular-nums text-gray-500">
          {count.toLocaleString("es-VE")} ({pct}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ExportCard({
  label,
  description,
  onCsv,
  onPdf,
  loadingCsv,
  loadingPdf,
  accent,
}: {
  label: string;
  description: string;
  onCsv: () => void;
  onPdf: () => void;
  loadingCsv: boolean;
  loadingPdf: boolean;
  accent: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-white px-4 py-3.5 shadow-sm ${accent}`}>
      <p className="text-sm font-semibold text-gray-800">{label}</p>
      <p className="text-xs text-gray-500 mt-0.5 mb-3">{description}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCsv}
          disabled={loadingCsv || loadingPdf}
          className="flex-1 text-xs font-semibold rounded-lg border border-border px-2.5 py-2 hover:bg-muted/60 transition-colors disabled:opacity-50"
        >
          {loadingCsv ? "…" : "CSV"}
        </button>
        <button
          type="button"
          onClick={onPdf}
          disabled={loadingCsv || loadingPdf}
          className="flex-1 text-xs font-semibold rounded-lg border border-primary/30 text-primary px-2.5 py-2 hover:bg-primary-light transition-colors disabled:opacity-50"
        >
          {loadingPdf ? "…" : "PDF"}
        </button>
      </div>
    </div>
  );
}

export function TabReportes() {
  const toast = useToast();
  const orgId = getClientOrganizationId();
  const [summary, setSummary] = useState<ReportesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<ExportKey | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reportes/summary?organization_id=${orgId}`);
      if (!res.ok) throw new Error("No se pudo cargar el resumen");
      setSummary(await res.json());
    } catch {
      toast.error("Error al cargar los reportes");
    } finally {
      setLoading(false);
    }
  }, [orgId, toast]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const download = async (type: ExportType, format: ExportFormat) => {
    const key: ExportKey = `${type}:${format}`;
    setExporting(key);
    try {
      const res = await fetch(
        `/api/reportes/export?type=${type}&format=${format}&organization_id=${orgId}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Error al exportar");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `reporte-${type}.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Descarga iniciada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al exportar");
    } finally {
      setExporting(null);
    }
  };

  const triajeTotal = summary
    ? summary.pacientes.triaje.Verde +
      summary.pacientes.triaje.Amarillo +
      summary.pacientes.triaje.Rojo
    : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="border-b border-border p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Reportes y Exportación</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Resumen operativo de pacientes y personas desaparecidas. Descarga en CSV o PDF.
              </p>
            </div>
            <button
              type="button"
              onClick={loadSummary}
              disabled={loading}
              className="text-xs font-semibold text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary-light transition-colors disabled:opacity-50"
            >
              Actualizar
            </button>
          </div>
          {summary?.generado_en && !loading && (
            <p className="text-[11px] text-gray-400 mt-2 font-mono">
              Actualizado:{" "}
              {new Date(summary.generado_en).toLocaleString("es-VE", {
                timeZone: "America/Caracas",
              })}{" "}
              VET
            </p>
          )}
        </div>

        <div className="p-6 space-y-8">
          {/* Pacientes */}
          <section>
            <h3 className="text-sm font-bold text-gray-800 mb-3">Pacientes registrados</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <StatCard
                loading={loading}
                value={summary?.pacientes.total ?? 0}
                label="Total pacientes"
                color="text-gray-900"
                ring="border-border"
              />
              <StatCard
                loading={loading}
                value={summary?.pacientes.triaje.Verde ?? 0}
                label="Triaje verde"
                color="text-triage-green"
                ring="border-triage-green/25"
              />
              <StatCard
                loading={loading}
                value={summary?.pacientes.triaje.Amarillo ?? 0}
                label="Triaje amarillo"
                color="text-triage-yellow"
                ring="border-triage-yellow/30"
              />
              <StatCard
                loading={loading}
                value={summary?.pacientes.triaje.Rojo ?? 0}
                label="Triaje rojo"
                color="text-crisis"
                ring="border-crisis/20"
              />
            </div>
            {!loading && triajeTotal > 0 && (
              <div className="space-y-2.5 max-w-md">
                <TriageBar
                  label="🟢 Verde"
                  count={summary?.pacientes.triaje.Verde ?? 0}
                  total={triajeTotal}
                  color="bg-triage-green"
                />
                <TriageBar
                  label="🟡 Amarillo"
                  count={summary?.pacientes.triaje.Amarillo ?? 0}
                  total={triajeTotal}
                  color="bg-triage-yellow"
                />
                <TriageBar
                  label="🔴 Rojo"
                  count={summary?.pacientes.triaje.Rojo ?? 0}
                  total={triajeTotal}
                  color="bg-crisis"
                />
              </div>
            )}
          </section>

          {/* Desaparecidos */}
          <section>
            <h3 className="text-sm font-bold text-gray-800 mb-1">Personas desaparecidas</h3>
            <p className="text-xs text-gray-500 mb-3">
              Total registrados: todos los reportes ingresados al sistema, sin importar su estado actual.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                loading={loading}
                value={summary?.desaparecidos.total ?? 0}
                label="Total registrados"
                color="text-gray-900"
                ring="border-border"
              />
              <StatCard
                loading={loading}
                value={summary?.desaparecidos.desaparecidos ?? 0}
                label="Desaparecidos"
                color="text-crisis"
                ring="border-crisis/20"
              />
              <StatCard
                loading={loading}
                value={summary?.desaparecidos.encontrados ?? 0}
                label="Encontrados"
                color="text-triage-green"
                ring="border-triage-green/25"
              />
              <StatCard
                loading={loading}
                value={summary?.desaparecidos.fallecidos ?? 0}
                label="Fallecidos"
                color="text-gray-600"
                ring="border-gray-200"
              />
            </div>
          </section>
        </div>
      </div>

      {/* Exportaciones */}
      <div className="bg-white rounded-xl shadow-sm border border-border p-6">
        <h3 className="text-sm font-bold text-gray-800 mb-1">Descargar datos</h3>
        <p className="text-xs text-gray-500 mb-4">
          CSV para Excel · PDF para impresión y archivo oficial.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ExportCard
            label="Resumen general"
            description="Totales y contadores agregados"
            onCsv={() => download("resumen", "csv")}
            onPdf={() => download("resumen", "pdf")}
            loadingCsv={exporting === "resumen:csv"}
            loadingPdf={exporting === "resumen:pdf"}
            accent=""
          />
          <ExportCard
            label="Lista de pacientes"
            description="Damnificados con ficha clínica"
            onCsv={() => download("pacientes", "csv")}
            onPdf={() => download("pacientes", "pdf")}
            loadingCsv={exporting === "pacientes:csv"}
            loadingPdf={exporting === "pacientes:pdf"}
            accent=""
          />
          <ExportCard
            label="Desaparecidos"
            description="Personas con estado Desaparecido"
            onCsv={() => download("desaparecidos", "csv")}
            onPdf={() => download("desaparecidos", "pdf")}
            loadingCsv={exporting === "desaparecidos:csv"}
            loadingPdf={exporting === "desaparecidos:pdf"}
            accent=""
          />
          <ExportCard
            label="Encontrados"
            description="Personas localizadas con vida"
            onCsv={() => download("encontrados", "csv")}
            onPdf={() => download("encontrados", "pdf")}
            loadingCsv={exporting === "encontrados:csv"}
            loadingPdf={exporting === "encontrados:pdf"}
            accent=""
          />
          <ExportCard
            label="Fallecidos"
            description="Confirmados fallecidos"
            onCsv={() => download("fallecidos", "csv")}
            onPdf={() => download("fallecidos", "pdf")}
            loadingCsv={exporting === "fallecidos:csv"}
            loadingPdf={exporting === "fallecidos:pdf"}
            accent=""
          />
        </div>
      </div>
    </div>
  );
}
