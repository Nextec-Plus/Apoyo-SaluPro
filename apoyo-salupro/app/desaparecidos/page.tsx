"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  type MissingPersonWithImages,
  firstImageUrl,
  STATUS_META,
} from "@/lib/missing-persons";
import { PersonModal } from "@/app/persona/person-modal";

const PAGE_SIZE = 16;

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
  user: "M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  back: "M19 12H5M12 19l-7-7 7-7",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
};

export default function DesaparecidosPage() {
  const [tab, setTab] = useState<"nombre" | "cedula">("nombre");
  const [q, setQ] = useState("");
  const [persons, setPersons] = useState<MissingPersonWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<MissingPersonWithImages | null>(null);
  const [page, setPage] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/missing-persons")
      .then((r) => r.json())
      .then((json) => {
        if (!active) return;
        if (json.error) setLoadError(true);
        else {
          const all = (json.data ?? []) as MissingPersonWithImages[];
          setPersons(all.filter((p) => p.estado === "Desaparecido"));
        }
      })
      .catch(() => active && setLoadError(true))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setPage(0);
  }, [q, tab]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return persons;
    if (tab === "cedula") return persons.filter((p) => (p.cedula ?? "").toLowerCase().includes(term));
    return persons.filter((p) => `${p.nombre} ${p.apellido}`.toLowerCase().includes(term));
  }, [persons, q, tab]);

  const m = STATUS_META["Desaparecido"];

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
        {/* Hero */}
        <section className="border-b border-border bg-gradient-to-b from-crisis/8 via-card to-card">
          <div className="mx-auto max-w-4xl px-4 pt-12 pb-10 sm:pt-16 sm:pb-14 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-crisis/10 text-crisis text-xs font-semibold px-3 py-1.5 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-crisis animate-pulse" />
              {loading ? "…" : `${persons.length} personas`} buscadas activamente
            </span>
            <h1 className="font-display text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight">
              Personas <span className="text-crisis">desaparecidas</span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-gray-600 max-w-xl mx-auto">
              Listado actualizado de quienes aún no han sido localizados tras el terremoto.
              Si tienes información, usa los datos de contacto del reporte.
            </p>

            {/* Buscador */}
            <div className="mt-8 mx-auto max-w-2xl rounded-2xl bg-card shadow-xl shadow-crisis/5 border border-border p-2.5">
              <div className="flex gap-1 px-1 pt-0.5 pb-2">
                {(["nombre", "cedula"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`text-sm font-semibold px-3.5 py-1.5 rounded-lg transition-colors ${
                      tab === t ? "bg-crisis/10 text-crisis" : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    {t === "nombre" ? "Por nombre" : "Por cédula"}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Icon path={I.search} className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  inputMode={tab === "cedula" ? "numeric" : "text"}
                  placeholder={tab === "nombre" ? "Buscar por nombre o apellido…" : "Buscar por cédula…"}
                  className="w-full rounded-xl border border-border bg-muted/60 pl-11 pr-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-crisis/30 focus:border-crisis/50 focus:bg-card transition-colors"
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500 flex items-center justify-center gap-1.5">
              <Icon path={I.shield} className="w-3.5 h-3.5 text-crisis" />
              Datos verificados por operadores de Apoyo SaluPro
            </p>
          </div>
        </section>

        {/* Grid */}
        <section className="bg-card">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
              <p className="text-sm font-medium text-gray-500">
                {loading ? "Cargando…" : `${filtered.length} persona${filtered.length !== 1 ? "s" : ""} encontrada${filtered.length !== 1 ? "s" : ""}`}
              </p>
              <Link
                href="/reportar"
                className="inline-flex items-center gap-1.5 rounded-lg bg-crisis hover:bg-crisis-dark text-white px-4 py-2 text-sm font-semibold transition-colors sm:hidden"
              >
                <Icon path={I.report} className="w-4 h-4" />
                Reportar
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-border bg-muted/50 animate-pulse overflow-hidden">
                    <div className="h-[240px] bg-muted" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 w-2/3 bg-muted rounded" />
                      <div className="h-3 w-1/2 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <p className="text-sm text-crisis bg-crisis/5 border border-crisis/20 rounded-xl px-4 py-3">
                No se pudo cargar el registro. Intenta de nuevo más tarde.
              </p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 rounded-2xl border border-dashed border-border">
                <div className="w-14 h-14 rounded-2xl bg-crisis/10 text-crisis/60 flex items-center justify-center mx-auto mb-4">
                  <Icon path={I.search} className="w-7 h-7" />
                </div>
                <p className="text-gray-600 font-medium">
                  {persons.length === 0
                    ? "No hay personas desaparecidas registradas aún."
                    : "Ningún registro coincide con tu búsqueda."}
                </p>
                <Link href="/reportar" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-crisis hover:text-crisis-dark">
                  <Icon path={I.report} className="w-4 h-4" />
                  Reportar una persona desaparecida
                </Link>
              </div>
            ) : (() => {
                const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
                const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
                const goTo = (p: number) => {
                  setPage(p);
                  gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                };
                return (
                  <>
                    <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                      {pageItems.map((p) => {
                        const img = firstImageUrl(p);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelected(p)}
                            className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden text-left hover:border-crisis/40 hover:shadow-lg hover:shadow-crisis/5 transition-all"
                          >
                            <div className="relative w-full h-[260px] shrink-0 bg-crisis/5 overflow-hidden">
                              {img ? (
                                <Image
                                  src={img}
                                  alt={`${p.nombre} ${p.apellido}`}
                                  fill
                                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                  className="object-cover object-center group-hover:scale-[1.02] transition-transform duration-300"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-crisis/30">
                                  <Icon path={I.user} className="w-14 h-14" />
                                </div>
                              )}
                            </div>
                            <div className="p-4 flex-1 flex flex-col">
                              <h3 className="font-semibold text-[15px] leading-snug">{p.nombre} {p.apellido}</h3>
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2 flex-1">
                                {[p.edad_aproximada ? `${p.edad_aproximada} años` : null, p.ultimo_lugar_visto]
                                  .filter(Boolean)
                                  .join(" · ") || "Sin detalles"}
                              </p>
                              <span className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold self-start ${m.chip}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                                {m.label}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {totalPages > 1 && (
                      <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
                        <button
                          onClick={() => goTo(page - 1)}
                          disabled={page === 0}
                          className="px-3 py-2 rounded-lg border border-border text-sm font-medium text-gray-600 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          ← Anterior
                        </button>
                        {Array.from({ length: totalPages }).map((_, i) => (
                          <button
                            key={i}
                            onClick={() => goTo(i)}
                            className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                              i === page
                                ? "bg-crisis text-white"
                                : "border border-border text-gray-600 hover:bg-muted"
                            }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                        <button
                          onClick={() => goTo(page + 1)}
                          disabled={page === totalPages - 1}
                          className="px-3 py-2 rounded-lg border border-border text-sm font-medium text-gray-600 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          Siguiente →
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
          </div>
        </section>
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

      {selected && <PersonModal person={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
