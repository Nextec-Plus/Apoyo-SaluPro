"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { MissingPersonSearchItem } from "@/lib/search/types";
import { missingPersonsConfig } from "@/lib/search/configs";
import { SearchProvider } from "@/components/search/SearchProvider";
import {
  ActiveChips,
  ResultCount,
  ResultsGrid,
  ResultsState,
  SearchBar,
} from "@/components/search/ui";
import {
  MissingPersonCard,
  MissingPersonCardSkeleton,
} from "@/components/search/MissingPersonCard";
import { PersonModal } from "@/app/persona/person-modal";
import type { PersonModalPerson } from "@/app/persona/person-modal";

function Icon({ path, className = "" }: { path: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

const I = {
  search: "m21 21-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z",
  report: "M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  back: "M19 12H5M12 19l-7-7 7-7",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
};

type Stats = { total: number; busquedas: number; encontradas: number };

/* Tarjetas de estadísticas globales (datos reales del endpoint /stats). */
function StatCards({ stats, loading }: { stats: Stats; loading: boolean }) {
  const cards = [
    { v: stats.total, label: "Personas registradas", color: "text-gray-900", ring: "border-border" },
    { v: stats.busquedas, label: "Aún buscadas", color: "text-crisis", ring: "border-crisis/20" },
    { v: stats.encontradas, label: "Encontradas", color: "text-triage-green", ring: "border-triage-green/25" },
  ];
  return (
    <div className="mt-7 grid grid-cols-3 gap-2.5 sm:gap-4 max-w-2xl mx-auto">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-2xl border bg-card px-3 py-4 sm:px-4 sm:py-5 shadow-sm ${c.ring}`}
        >
          <div className={`font-display text-2xl sm:text-4xl font-extrabold tabular-nums ${c.color}`}>
            {loading ? "—" : c.v.toLocaleString("es-VE")}
          </div>
          <div className="mt-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500 leading-tight">
            {c.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DesaparecidosPage() {
  const [selected, setSelected] = useState<PersonModalPerson | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, busquedas: 0, encontradas: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/missing-persons/stats")
        .then((r) => r.json())
        .then((json) => { if (active && !json.error) setStats(json) })
        .catch(() => {})
        .finally(() => active && setStatsLoading(false));
    load();
    const id = setInterval(() => { if (document.visibilityState === "visible") load() }, 90_000);
    const onVis = () => { if (document.visibilityState === "visible") load() };
    document.addEventListener("visibilitychange", onVis);
    return () => { active = false; clearInterval(id); document.removeEventListener("visibilitychange", onVis) };
  }, []);

  return (
    <div className="flex flex-col min-h-screen text-gray-900">
      {/* Crisis banner */}
      <div className="bg-crisis text-white">
        <div className="mx-auto max-w-7xl px-4 py-2 flex items-center gap-2.5 text-xs font-semibold tracking-wide">
          <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
          <span className="uppercase">Crisis activa</span>
          <span className="opacity-80">· Terremoto La Guaira · 25 Jun 2026</span>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/85 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center gap-4 sm:gap-6">
          <Link href="/" className="flex items-center shrink-0">
            <Image src="/logo_salupro_light.png" alt="SaluPro" width={150} height={45} priority className="h-8 sm:h-9 w-auto" />
          </Link>

          <div className="flex items-center gap-1.5 text-sm text-gray-500 ml-1 min-w-0">
            <Link href="/" className="hidden sm:inline hover:text-primary transition-colors shrink-0">Inicio</Link>
            <span className="hidden sm:inline text-gray-300">/</span>
            <span className="font-semibold text-crisis truncate">Personas desaparecidas</span>
          </div>

          <div className="ml-auto flex items-center gap-2.5 shrink-0">
            <Link
              href="/reportar"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-crisis hover:bg-crisis-dark text-white px-4 py-2 text-sm font-semibold transition-colors"
            >
              <Icon path={I.report} className="w-4 h-4" />
              Reportar persona
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-gray-600 hover:text-primary hover:border-primary/40 transition-colors"
            >
              <Icon path={I.back} className="w-4 h-4" />
              <span className="hidden sm:inline">Volver</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <SearchProvider config={missingPersonsConfig} initialFilters={{ estado: "Desaparecido" }} autoRefreshMs={90_000}>
          {/* Hero + buscador */}
          <section className="border-b border-border bg-gradient-to-b from-crisis/8 via-card to-card">
            <div className="mx-auto max-w-4xl px-4 pt-12 pb-10 sm:pt-16 sm:pb-14 text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-crisis/10 text-crisis text-xs font-semibold px-3 py-1.5 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-crisis animate-pulse" />
                Personas buscadas activamente
              </span>
              <h1 className="font-display text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight">
                Personas <span className="text-crisis">desaparecidas</span>
              </h1>
              <p className="mt-4 text-sm sm:text-base text-gray-600 max-w-xl mx-auto">
                Listado actualizado de quienes aún no han sido localizados tras el terremoto.
                Si tienes información, usa los datos de contacto del reporte.
              </p>

              {/* Estadísticas globales */}
              <StatCards stats={stats} loading={statsLoading} />

              {/* Buscador */}
              <div className="mt-8 mx-auto max-w-2xl rounded-2xl bg-card shadow-xl shadow-crisis/5 border border-border px-3 py-3">
                <SearchBar
                  placeholder="Buscar por nombre, apellido o cédula…"
                  accent="crisis"
                />
              </div>
              <p className="mt-3 text-xs text-gray-500 flex items-center justify-center gap-1.5">
                <Icon path={I.shield} className="w-3.5 h-3.5 text-crisis" />
                Datos verificados por operadores de Apoyo SaluPro
              </p>
            </div>
          </section>

          {/* Grid + filtros */}
          <section className="bg-card">
            <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <ResultCount
                  loadingLabel="Cargando…"
                  formatter={(c) => `${c} persona${c !== 1 ? "s" : ""} encontrada${c !== 1 ? "s" : ""}`}
                />
                <Link
                  href="/reportar"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-crisis hover:bg-crisis-dark text-white px-4 py-2 text-sm font-semibold transition-colors sm:hidden"
                >
                  <Icon path={I.report} className="w-4 h-4" />
                  Reportar
                </Link>
              </div>

              <ActiveChips />

              <div className="mt-4">
                <ResultsGrid
                  columns="sm:grid-cols-2 md:grid-cols-4"
                  skeleton={<MissingPersonCardSkeleton />}
                  skeletonCount={8}
                  renderItem={(p: MissingPersonSearchItem) => (
                    <MissingPersonCard
                      key={p.id}
                      p={p}
                      onOpen={setSelected}
                      accent="crisis"
                    />
                  )}
                />

                <ResultsState
                  emptyTitle="No hay personas desaparecidas registradas aún."
                  emptyAction={
                    <Link href="/reportar" className="inline-flex items-center gap-1.5 text-sm font-semibold text-crisis hover:text-crisis-dark">
                      <Icon path={I.report} className="w-4 h-4" />
                      Reportar una persona desaparecida
                    </Link>
                  }
                />
              </div>
            </div>
          </section>
        </SearchProvider>
      </main>

      {/* Footer minimal */}
      <footer className="border-t border-border bg-muted/30 py-6 px-4">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <p>© {new Date().getFullYear()} Apoyo SaluPro · Sistema de registro de personas desaparecidas</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-gray-600 transition-colors">Inicio</Link>
            <Link href="/reportar" className="hover:text-gray-600 transition-colors">Reportar persona</Link>
          </div>
        </div>
      </footer>

      {selected && (
        <PersonModal
          person={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}