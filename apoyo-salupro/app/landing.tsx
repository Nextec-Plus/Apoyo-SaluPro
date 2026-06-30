"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { MissingPersonSearchItem } from "@/lib/search/types";
import { missingPersonsPagedConfig, type MissingPersonsFilters } from "@/lib/search/configs";
import { SearchProvider, useSearch } from "@/components/search/SearchProvider";
import {
  ActiveChips,
  FilterPanel,
  Pagination,
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

/* ── Contador animado ───────────────────────────────────────────────────── */

function Counter({ to }: { to: number }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const dur = 1400;
        const tick = (t: number) => {
          const p = Math.min((t - start) / dur, 1);
          setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);

  return <span ref={ref}>{n.toLocaleString("es-VE")}</span>;
}

/* ── Iconos ─────────────────────────────────────────────────────────────── */

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
  heart: "M19 14c1.5-1.5 3-3.4 3-5.5A4.5 4.5 0 0 0 12 5.5 4.5 4.5 0 0 0 2 8.5c0 2.1 1.5 4 3 5.5l7 7Z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z",
  login: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3",
  arrow: "M5 12h14M13 6l6 6-6 6",
  check: "M20 6 9 17l-5-5",
  verify: "m9 12 2 2 4-4M12 3l7 4v5c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V7l7-4Z",
  insumos: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6M12 12v4M10 14h4",
};

/* ── Landing ────────────────────────────────────────────────────────────── */

export default function Landing() {
  const [menu, setMenu] = useState(false);
  const [stats, setStats] = useState({ total: 0, busquedas: 0, encontradas: 0, fallecidas: 0 });
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
    // Re-fetch stats cada 90 s cuando la pestaña está activa.
    const id = setInterval(() => { if (document.visibilityState === "visible") load() }, 90_000);
    const onVis = () => { if (document.visibilityState === "visible") load() };
    document.addEventListener("visibilitychange", onVis);
    return () => { active = false; clearInterval(id); document.removeEventListener("visibilitychange", onVis) };
  }, []);

  return (
    <div className="flex flex-col min-h-screen text-gray-900">
      <CrisisBanner />
      <SiteHeader menu={menu} setMenu={setMenu} />

      <main className="flex-1">
        <SearchProvider config={missingPersonsPagedConfig} autoRefreshMs={90_000}>
          <HeroSearchSection />

          <CountersSection stats={stats} loading={statsLoading} />

          <CasosSection />
        </SearchProvider>

        <HowItWorksSection />
        <AlianzaSection />
        <EmergenciaSection />
      </main>

      <SiteFooter />
    </div>
  );
}

/* ── Crisis Banner ───────────────────────────────────────────────────────── */

function CrisisBanner() {
  return (
    <div className="bg-crisis text-white">
      <div className="mx-auto max-w-7xl px-4 py-2 flex items-center gap-2.5 text-xs font-semibold tracking-wide">
        <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
        <span className="uppercase">Crisis activa</span>
        <span className="opacity-80">· Terremoto La Guaira · 25 Jun 2026</span>
        <a href="#emergencia" className="ml-auto hidden sm:inline underline underline-offset-2 hover:opacity-80">
          Líneas de emergencia
        </a>
      </div>
    </div>
  );
}

/* ── Header ──────────────────────────────────────────────────────────────── */

function SiteHeader({ menu, setMenu }: { menu: boolean; setMenu: (v: boolean | ((prev: boolean) => boolean)) => void }) {
  return (
    <header className="sticky top-0 z-40 bg-card/85 backdrop-blur-md border-b border-border">
      <div className="mx-auto max-w-7xl px-4 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center shrink-0">
          <Image src="/logo_salupro_light.png" alt="SaluPro" width={150} height={45} priority className="h-9 w-auto" />
        </Link>

        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-gray-600 ml-2">
          <a href="#buscar" className="hover:text-primary transition-colors">Buscar</a>
          <a href="#casos" className="hover:text-primary transition-colors">Registros</a>
          <a href="#como" className="hover:text-primary transition-colors">Cómo funciona</a>
          <a href="#alianza" className="hover:text-primary transition-colors">Alianza</a>
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <Link
            href="/desaparecidos"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-crisis/30 text-crisis hover:bg-crisis/5 px-4 py-2 text-sm font-semibold transition-colors"
          >
            <Icon path={I.search} className="w-4 h-4" />
            Desaparecidos
          </Link>
          <Link
            href="/solicitar-insumos"
            className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-primary/40 text-primary hover:bg-primary-light px-4 py-2 text-sm font-semibold transition-colors"
          >
            <Icon path={I.insumos} className="w-4 h-4" />
            Solicitar insumos
          </Link>
          <Link
            href="/reportar"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-crisis hover:bg-crisis-dark text-white px-4 py-2 text-sm font-semibold transition-colors"
          >
            <Icon path={I.report} className="w-4 h-4" />
            Reportar persona
          </Link>
          <button
            onClick={() => setMenu((v) => !v)}
            className="lg:hidden p-2 -mr-2 text-gray-700"
            aria-label="Menú"
            aria-expanded={menu}
          >
            <Icon path={menu ? "M18 6 6 18M6 6l12 12" : "M4 7h16M4 12h16M4 17h16"} className="w-6 h-6" />
          </button>
        </div>
      </div>

      {menu && (
        <nav className="lg:hidden border-t border-border bg-card px-4 py-3 flex flex-col gap-1 text-sm font-medium text-gray-700">
          {[
            ["Buscar", "#buscar"],
            ["Registros", "#casos"],
            ["Cómo funciona", "#como"],
            ["Alianza", "#alianza"],
          ].map(([label, href]) => (
            <a key={href} href={href} onClick={() => setMenu(false)} className="py-2 hover:text-primary">
              {label}
            </a>
          ))}
          <Link href="/desaparecidos" onClick={() => setMenu(false)} className="mt-1 py-2 font-semibold text-crisis">
            Personas desaparecidas
          </Link>
          <Link href="/solicitar-insumos" onClick={() => setMenu(false)} className="py-2 font-semibold text-primary">
            📋 Solicitar insumos
          </Link>
          <Link href="/reportar" onClick={() => setMenu(false)} className="py-2 font-semibold text-crisis">
            + Reportar persona
          </Link>
        </nav>
      )}
    </header>
  );
}

/* ── Hero + Buscador ─────────────────────────────────────────────────────── */

function HeroSearchSection() {
  return (
    <section
      id="buscar"
      className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary-light/60 via-card to-card"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "radial-gradient(40rem 30rem at 85% -10%, color-mix(in srgb, var(--color-primary) 16%, transparent), transparent), radial-gradient(30rem 24rem at 0% 110%, color-mix(in srgb, var(--color-crisis) 8%, transparent), transparent)",
        }}
      />
      <div className="relative mx-auto max-w-4xl px-4 pt-16 pb-14 sm:pt-24 sm:pb-20 text-center">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-light text-primary-dark text-xs font-semibold px-3 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Plataforma humanitaria · Venezuela
          </span>

          <h1 className="font-display text-4xl sm:text-6xl font-extrabold leading-[1.05] tracking-tight text-gray-900">
            Alguien te está esperando.
            <br className="hidden sm:block" />{" "}
            <span className="text-primary">Ayúdanos a encontrarlo.</span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
            Registro centralizado y gratuito de personas desaparecidas tras la
            catástrofe. Busca a un ser querido o reporta una desaparición.
          </p>
        </div>

        {/* Buscador unificado (nombre, apellido o cédula en un solo campo) */}
        <div className="mt-9 animate-fade-up" style={{ animationDelay: "120ms" }}>
          <div className="mx-auto max-w-2xl rounded-2xl bg-card shadow-xl shadow-primary/5 border border-border px-3 py-3">
            <SearchBar
              placeholder="Buscar por nombre, apellido o cédula…"
              accent="primary"
            />
          </div>
          <p className="mt-3 text-xs text-gray-500 flex items-center justify-center gap-1.5">
            <Icon path={I.shield} className="w-3.5 h-3.5 text-primary" />
            Datos verificados por operadores de Apoyo SaluPro
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── Contadores (datos reales desde stats endpoint) ──────────────────────── */

function CountersSection({
  stats,
  loading,
}: {
  stats: { total: number; busquedas: number; encontradas: number; fallecidas: number };
  loading: boolean;
}) {
  const { setFilter } = useSearch<MissingPersonSearchItem, MissingPersonsFilters>();

  // Al pulsar un contador: filtra la grilla por ese estado y baja al listado.
  const go = (estado: string) => {
    setFilter("estado", estado);
    if (typeof document !== "undefined") {
      document.getElementById("casos")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const items: { v: number; label: string; color: string; estado: string }[] = [
    { v: stats.total, label: "Personas registradas", color: "text-gray-900", estado: "todos" },
    { v: stats.busquedas, label: "Aún buscadas", color: "text-crisis", estado: "Desaparecido" },
    { v: stats.encontradas, label: "Encontradas", color: "text-triage-green", estado: "Encontrado" },
    { v: stats.fallecidas, label: "Fallecidas", color: "text-gray-600", estado: "Confirmado Fallecido" },
  ];

  return (
    <section className="border-b border-border bg-card">
      <div className="mx-auto max-w-4xl px-4 py-10 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center">
        {items.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => go(s.estado)}
            className="group rounded-xl px-2 py-2 transition-colors hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring"
            aria-label={`Ver ${s.label.toLowerCase()}`}
          >
            <div className={`font-display text-3xl sm:text-5xl font-extrabold ${s.color}`}>
              {loading ? "—" : <Counter to={s.v} />}
            </div>
            <div className="mt-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-gray-500 group-hover:text-gray-700">
              {s.label}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ── Registros — grid con infinite scroll ────────────────────────────────── */

function CasosSection() {
  const [selected, setSelected] = useState<PersonModalPerson | null>(null);
  const casosRef = useRef<HTMLElement>(null);

  return (
    <section ref={casosRef} id="casos" className="bg-card border-b border-border scroll-mt-20">
      <div className="mx-auto max-w-[1600px] px-2 sm:px-3 py-12 sm:py-16">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Registro central</p>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">Personas registradas</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <CasosFilter />
            <ResultCount
              loadingLabel="Cargando…"
              formatter={(c) => `${c} persona${c !== 1 ? "s" : ""}`}
            />
          </div>
        </div>

        <ActiveChips />

        <div className="mt-4">
          <ResultsGrid
            columns="sm:grid-cols-2 lg:grid-cols-4"
            gap="gap-2 sm:gap-3"
            skeleton={<MissingPersonCardSkeleton />}
            skeletonCount={8}
            renderItem={(p: MissingPersonSearchItem) => (
              <MissingPersonCard
                key={p.id}
                p={p}
                onOpen={setSelected}
                accent="primary"
              />
            )}
          />

          <ResultsState
            emptyTitle="Ningún registro coincide con tu búsqueda."
            emptyAction={
              <Link href="/reportar" className="inline-flex items-center gap-1.5 text-sm font-semibold text-crisis hover:text-crisis-dark">
                <Icon path={I.report} className="w-4 h-4" />
                Reportar una persona desaparecida
              </Link>
            }
          />

          <Pagination accent="primary" />
        </div>
      </div>

      {selected && (
        <PersonModal
          key={selected.id}
          person={selected as PersonModalPerson}
          onClose={() => setSelected(null)}
          publicFound
        />
      )}
    </section>
  );
}

function CasosFilter() {
  return <FilterPanel layout="inline" />;
}

/* ── Cómo funciona ───────────────────────────────────────────────────────── */

function HowItWorksSection() {
  return (
    <section id="como" className="bg-muted/50 border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Cómo funciona</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
            Tres pasos para reencontrar a quien buscas
          </h2>
        </div>

        <div className="mt-10 sm:mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {[
            { icon: I.search, n: "01", t: "Busca", d: "Consulta el registro central por nombre, apellido o cédula. Actualizado por los equipos en campo." },
            { icon: I.report, n: "02", t: "Reporta", d: "¿No aparece? Reporta la desaparición con su foto y datos de contacto para activar la búsqueda." },
            { icon: I.heart, n: "03", t: "Conecta", d: "Quien tenga información usa los datos de contacto del reporte para coordinar la reunificación." },
          ].map((step) => (
            <div key={step.n} className="relative rounded-2xl bg-card border border-border p-7 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all">
              <span className="absolute top-6 right-7 font-display text-4xl font-extrabold text-primary-light select-none">
                {step.n}
              </span>
              <div className="w-12 h-12 rounded-xl bg-primary-light flex items-center justify-center text-primary mb-5">
                <Icon path={step.icon} className="w-6 h-6" />
              </div>
              <h3 className="font-display text-xl font-bold mb-2">{step.t}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{step.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Alianzas ────────────────────────────────────────────────────────────── */

function AlianzaSection() {
  return (
    <section id="alianza" className="bg-muted/50 border-b border-border scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20 space-y-6">

        {/* La Vaca — crowdfunding */}
        <div className="rounded-3xl border border-border bg-card overflow-hidden grid lg:grid-cols-[1.3fr_1fr]">
          <div className="p-8 sm:p-12">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-light text-primary-dark text-xs font-semibold px-3 py-1.5 mb-6">
              <Icon path={I.heart} className="w-3.5 h-3.5" />
              Alianza · La Vaca
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              Recaudamos juntos para causas
              <br className="hidden sm:block" />{" "}
              <span className="text-primary">que de verdad existen.</span>
            </h2>
            <p className="mt-5 text-gray-600 leading-relaxed max-w-xl">
              Apoyo SaluPro se une a <strong className="text-gray-900">La Vaca</strong>, la plataforma
              de crowdfunding transparente para Venezuela. Las familias afectadas por la
              catástrofe pueden recibir ayuda económica verificada para emergencias médicas,
              refugio y reunificación.
            </p>

            <ul className="mt-7 grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                "Identidad verificada, sin excepciones",
                "Garantes que ponen su nombre",
                "Cada donación se puede seguir",
                "Paga como puedas pagar",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-gray-700">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-primary-light text-primary flex items-center justify-center shrink-0">
                    <Icon path={I.check} className="w-3 h-3" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <a
              href="https://lavaca.com.ve"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-3 text-sm transition-colors"
            >
              Donar a través de La Vaca
              <Icon path={I.arrow} className="w-4 h-4" />
            </a>
          </div>

          <div className="relative hidden lg:grid grid-cols-2 grid-rows-2 gap-1.5 p-1.5 bg-gray-900 min-h-[26rem]">
            <div className="relative row-span-2 rounded-l-2xl overflow-hidden">
              <Image src="/crowdfunding-1.webp" alt="Familias afectadas por la catástrofe" fill sizes="25vw" className="object-cover" />
            </div>
            <div className="relative overflow-hidden">
              <Image src="/crowdfunding-2.webp" alt="Rescate de personas tras el sismo" fill sizes="25vw" className="object-cover" />
            </div>
            <div className="relative overflow-hidden">
              <Image src="/crowdfunding-3.webp" alt="Edificación colapsada" fill sizes="25vw" className="object-cover" />
            </div>
            <div className="absolute inset-1.5 rounded-2xl bg-gradient-to-t from-gray-950/85 via-gray-950/10 to-transparent pointer-events-none" />
            <div className="absolute left-5 right-5 bottom-5 text-white">
              <Icon path={I.verify} className="w-9 h-9 mb-2 opacity-90" />
              <p className="font-display text-xl font-bold leading-snug">
                Crowdfunding transparente para Venezuela
              </p>
              <p className="mt-1.5 text-white/80 text-xs">
                KYC obligatorio · garantes reales · conversión BCV · bolívares, divisas o cripto.
              </p>
            </div>
          </div>
        </div>

        {/* Venezuela te busca — plataforma ciudadana */}
        <div className="rounded-3xl border border-border bg-card overflow-hidden grid md:grid-cols-[auto_1fr] items-center gap-0">
          {/* Lateral de color */}
          <div className="hidden md:flex flex-col items-center justify-center gap-3 bg-[#FDECEA] px-10 py-12 self-stretch rounded-l-3xl min-w-[200px]">
            <span className="text-5xl select-none" aria-hidden>🇻🇪</span>
            <span className="font-display text-sm font-bold text-[#C0392B] text-center leading-tight">
              Venezuela<br />te busca
            </span>
          </div>

          {/* Contenido */}
          <div className="p-8 sm:p-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#FDECEA] text-[#C0392B] text-xs font-semibold px-3 py-1.5 mb-5">
              <Icon path={I.heart} className="w-3.5 h-3.5" />
              Alianza · Venezuela te busca
            </span>
            <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
              Registro ciudadano de personas
              <span className="text-[#C0392B]"> desaparecidas.</span>
            </h3>
            <p className="mt-4 text-gray-600 leading-relaxed max-w-2xl text-sm sm:text-base">
              Iniciativa voluntaria y sin fines de lucro que complementa nuestra plataforma. Más de{" "}
              <strong className="text-gray-900">25.000 personas</strong> registradas por ciudadanos
              para ayudar a localizar a familiares desaparecidos tras el terremoto de Venezuela 2026.
              Los datos son usados exclusivamente para la localización de personas.
            </p>
            <a
              href="https://venezuela-te-busca-app.hellogafaro.workers.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[#C0392B]/30 text-[#C0392B] hover:bg-[#FDECEA] font-semibold px-5 py-2.5 text-sm transition-colors"
            >
              Visitar Venezuela te busca
              <Icon path={I.arrow} className="w-4 h-4" />
            </a>
          </div>
        </div>

      </div>
    </section>
  );
}

/* ── Emergencia ──────────────────────────────────────────────────────────── */

function EmergenciaSection() {
  return (
    <section id="emergencia" className="bg-crisis text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
        <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
          <Icon path={I.phone} className="w-7 h-7" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-2xl sm:text-3xl font-bold">¿Es una emergencia activa?</h2>
          <p className="text-white/80 text-sm mt-1">
            Atención inmediata las 24 horas para personas en riesgo o heridas.
          </p>
        </div>
        <a
          href="tel:911"
          className="inline-flex items-center gap-2 rounded-xl bg-white text-crisis font-bold px-7 py-3.5 text-lg hover:bg-crisis-light transition-colors"
        >
          <Icon path={I.phone} className="w-5 h-5" />
          Llamar 911
        </a>
      </div>
    </section>
  );
}

/* ── Footer ──────────────────────────────────────────────────────────────── */

function SiteFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="mx-auto max-w-7xl px-4 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Image
              src="/logo_salupro_light.png"
              alt="SaluPro"
              width={150}
              height={45}
              className="h-9 w-auto brightness-0 invert opacity-90"
            />
            <p className="mt-4 text-sm leading-relaxed max-w-xs">
              Plataforma pública de búsqueda y reunificación de personas afectadas por catástrofes.
              Venezuela.
            </p>
          </div>

          <div>
            <h3 className="text-white text-sm font-semibold mb-4">Plataforma</h3>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#buscar" className="hover:text-white transition-colors">Buscar personas</a></li>
              <li><Link href="/reportar" className="hover:text-white transition-colors">Reportar desaparición</Link></li>
              <li><a href="#alianza" className="hover:text-white transition-colors">Alianzas</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white text-sm font-semibold mb-4">Emergencias</h3>
            <ul className="space-y-2.5 text-sm">
              <li><a href="tel:911" className="hover:text-white transition-colors">Línea 911</a></li>
              <li><a href="#emergencia" className="hover:text-white transition-colors">Apoyo psicológico</a></li>
              <li><a href="https://lavaca.com.ve" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Donar · La Vaca</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs">© {new Date().getFullYear()} Apoyo SaluPro · Sistema de registro de personas desaparecidas</p>

          <a
            href="https://nextec.plus"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2.5 text-xs"
          >
            <span className="text-gray-500">Desarrollado por</span>
            <Image src="/nextec.svg" alt="nextec" width={20} height={20} className="h-5 w-5 transition-transform group-hover:rotate-90" />
            <span className="font-semibold text-gray-200 group-hover:text-white transition-colors tracking-wide lowercase">
              nextec
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}