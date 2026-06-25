"use client";

import { useCallback, useEffect, useState } from "react";
import { getClientOrganizationId } from "@/lib/config";
import type { ReportesSummary } from "@/lib/reportes/summary";
import { useToast } from "@/components/toast-provider";

type ExportType = "resumen" | "pacientes" | "desaparecidos" | "encontrados" | "fallecidos";

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

function ExportButton({
  label,
  description,
  onClick,
  loading,
  accent,
}: {
  label: string;
  description: string;
  onClick: () => void;
  loading: boolean;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`flex flex-col items-start gap-1 rounded-xl border border-border bg-white px-4 py-3.5 text-left shadow-sm transition-colors hover:bg-muted/50 disabled:opacity-60 ${accent}`}
    >
      <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
        <span aria-hidden>⬇</span>
        {label}
      </span>
      <span className="text-xs text-gray-500">{description}</span>
    </button>
  );
}

export function TabReportes() {
  const toast = useToast();
  const orgId = getClientOrganizationId();
  const [summary, setSummary] = useState<ReportesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<ExportType | null>(null);

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

  const download = async (type: ExportType) => {
    setExporting(type);
    try {
      const res = await fetch(
        `/api/reportes/export?type=${type}&organization_id=${orgId}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Error al exportar");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `reporte-${type}.csv`;

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
                Resumen operativo de pacientes y personas desaparecidas. Descarga los datos en CSV.
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
        <h3 className="text-sm font-bold text-gray-800 mb-1">Descargar datos (CSV)</h3>
        <p className="text-xs text-gray-500 mb-4">
          Los archivos incluyen BOM UTF-8 para abrir correctamente en Excel.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ExportButton
            label="Resumen general"
            description="Totales y contadores agregados"
            onClick={() => download("resumen")}
            loading={exporting === "resumen"}
            accent="hover:border-primary/40"
          />
          <ExportButton
            label="Lista de pacientes"
            description="Todos los damnificados con ficha clínica"
            onClick={() => download("pacientes")}
            loading={exporting === "pacientes"}
            accent="hover:border-primary/40"
          />
          <ExportButton
            label="Desaparecidos"
            description="Personas con estado Desaparecido"
            onClick={() => download("desaparecidos")}
            loading={exporting === "desaparecidos"}
            accent="hover:border-crisis/30"
          />
          <ExportButton
            label="Encontrados"
            description="Personas localizadas con vida"
            onClick={() => download("encontrados")}
            loading={exporting === "encontrados"}
            accent="hover:border-triage-green/40"
          />
          <ExportButton
            label="Fallecidos"
            description="Confirmados fallecidos"
            onClick={() => download("fallecidos")}
            loading={exporting === "fallecidos"}
            accent="hover:border-gray-300"
          />
        </div>
      </div>
    </div>
  );
}
