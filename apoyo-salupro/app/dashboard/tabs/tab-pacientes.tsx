"use client";

import { generoDbToUi } from "@/lib/config";
import { patientsConfig } from "@/lib/search/configs";
import type { PatientSearchItem, PatientSearchInfo } from "@/lib/search/types";
import { SearchProvider } from "@/components/search/SearchProvider";
import {
  ActiveChips,
  FilterPanel,
  ResultCount,
  ResultsList,
  ResultsState,
  SearchBar,
} from "@/components/search/ui";

function triageBadge(category: string | null | undefined) {
  if (category === "Verde") return "bg-green-100 text-triage-green border-triage-green/30";
  if (category === "Amarillo") return "bg-amber-100 text-triage-yellow border-triage-yellow/30";
  if (category === "Rojo") return "bg-red-100 text-crisis border-crisis/30";
  return "bg-gray-100 text-gray-500 border-gray-200";
}

function getInfo(
  row: PatientSearchItem,
): PatientSearchInfo | null {
  const info = row.catastrophe_victim_info;
  if (!info) return null;
  return Array.isArray(info) ? info[0] ?? null : info;
}

function PatientRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-6 py-4 animate-pulse">
      <div className="shrink-0 w-10 h-10 rounded-full bg-muted" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-2/3 bg-muted rounded" />
        <div className="h-3 w-1/3 bg-muted rounded" />
      </div>
      <div className="w-16 h-5 bg-muted rounded" />
    </div>
  );
}

function PatientsVirtualizedList({
  onOpenPatient,
}: {
  onOpenPatient: (id: string) => void;
}) {
  return (
    <ResultsList
      rowHeight={86}
      maxHeight="62vh"
      skeleton={<PatientRowSkeleton />}
      skeletonCount={6}
      renderRow={(p: PatientSearchItem) => {
        const info = getInfo(p);
        return (
          <button
            type="button"
            onClick={() => onOpenPatient(p.id)}
            className="w-full flex items-center gap-4 px-6 py-4 hover:bg-muted/60 transition-colors group text-left"
          >
            <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
              {p.registration_number?.replace("V-", "") ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-primary transition-colors">
                {p.nombre_completo}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {[p.cedula, p.edad ? `${p.edad} años` : null, generoDbToUi(p.genero)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {info?.motivo_principal_consulta && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {info.motivo_principal_consulta}
                </p>
              )}
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              {info?.triage_category && (
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${triageBadge(info.triage_category)}`}
                >
                  {info.triage_category}
                </span>
              )}
              <span className="text-[10px] text-gray-400 font-mono">
                {p.registration_number}
              </span>
            </div>
            <span className="text-gray-300 group-hover:text-primary transition-colors">›</span>
          </button>
        );
      }}
    />
  );
}

export function TabPacientes({ onOpenPatient }: { onOpenPatient: (id: string) => void }) {
  return (
    <SearchProvider config={patientsConfig}>
      <PacientesUI onOpenPatient={onOpenPatient} />
    </SearchProvider>
  );
}

function PacientesUI({ onOpenPatient }: { onOpenPatient: (id: string) => void }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
      <div className="border-b border-border p-6 pb-5">
        <h2 className="text-lg font-bold text-gray-800">Pacientes Registrados</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Lista de damnificados ingresados en la clínica móvil. Haz clic para ver la ficha completa.
        </p>

        {/* Buscador */}
        <div className="mt-4">
          <SearchBar placeholder="Buscar por nombre…" accent="primary" />
        </div>

        {/* Filtros avanzados */}
        <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
          <FilterPanel
            layout="inline"
            className="[&>label]:min-w-[8rem] [&>label]:flex-1 sm:[&>label]:flex-none"
          />
        </div>

        {/* Chips + conteo */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <ActiveChips />
          <ResultCount
            loadingLabel="Cargando…"
            formatter={(c) => `${c} paciente${c !== 1 ? "s" : ""}`}
          />
        </div>
      </div>

      <PatientsVirtualizedList onOpenPatient={onOpenPatient} />

      <ResultsState
        emptyTitle="Ningún paciente coincide con los filtros."
        emptyHint="Ajusta la búsqueda o los filtros para ver más resultados."
      />
    </div>
  );
}