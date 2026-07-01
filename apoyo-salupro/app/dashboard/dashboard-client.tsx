"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DevCredit } from "@/components/dev-credit";
import { TabFicha }        from "./tabs/tab-ficha";
import { TabDesaparecidos } from "./tabs/tab-desaparecidos";
import { TabEncontrados }  from "./tabs/tab-encontrados";
import { TabTriaje }       from "./tabs/tab-triaje";
import { TabPacientes }    from "./tabs/tab-pacientes";
import { TabReportes }     from "./tabs/tab-reportes";
import { PatientModal }    from "./patient-modal";

type Tab = "ficha" | "pacientes" | "desaparecidos" | "encontrados" | "triaje" | "reportes";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "ficha",         label: "Ficha Médica",           icon: "📋" },
  { id: "pacientes",     label: "Pacientes",              icon: "👥" },
  { id: "desaparecidos", label: "Personas Desaparecidas", icon: "🔍" },
  { id: "encontrados",   label: "Encontrados",            icon: "✅" },
  { id: "triaje",        label: "Triaje",                 icon: "🏥" },
  { id: "reportes",      label: "Reportes",               icon: "📊" },
];

export function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const pacienteParam = searchParams.get("paciente");
  const [activeTab, setActiveTab] = useState<Tab>(
    initialTab === "pacientes" || initialTab === "desaparecidos" || initialTab === "encontrados" || initialTab === "triaje" || initialTab === "reportes"
      ? initialTab
      : "ficha",
  );
  const [clock, setClock]         = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(pacienteParam);
  const [patientsRefreshKey, setPatientsRefreshKey] = useState(0);

  useEffect(() => {
    if (pacienteParam) {
      setSelectedPatientId(pacienteParam);
      setActiveTab("pacientes");
    }
  }, [pacienteParam]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const openPatient = useCallback((id: string) => {
    setSelectedPatientId(id);
    setActiveTab("pacientes");
    router.replace(`/dashboard?tab=pacientes&paciente=${id}`, { scroll: false });
  }, [router]);

  const closePatient = useCallback(() => {
    setSelectedPatientId(null);
    router.replace("/dashboard?tab=pacientes", { scroll: false });
  }, [router]);

  const handlePatientUpdated = useCallback(() => {
    setPatientsRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={
        activeTab === "triaje"
          ? "flex flex-col h-dvh overflow-hidden bg-muted"
          : "flex flex-col min-h-screen bg-muted"
      }
    >

      {/* ── Crisis banner ─────────────────────────────────────────────── */}
      <div className="bg-crisis">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-2">
          <span className="text-white text-xs font-semibold">
            🔴 TERREMOTO LA GUAIRA — 25 JUN 2026 · Unidad de Clínica Móvil y Registro de Damnificados
          </span>
        </div>
      </div>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-border shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">

          {/* Logo + nombre */}
          <div className="flex items-center gap-3 min-w-0">
            <Image
              src="/isotipo_salupro_light.png"
              alt="Apoyo SaluPro"
              width={36}
              height={36}
              className="shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-display text-xs font-bold text-primary uppercase tracking-widest leading-none">
                  Apoyo SaluPro
                </p>
                {/* Indicador de crisis */}
                <div className="hidden sm:flex items-center gap-1.5 bg-crisis-light border border-crisis/20 rounded-full px-2.5 py-0.5 ml-3">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-crisis animate-pulse" />
                  <span className="text-[11px] font-semibold text-crisis uppercase tracking-wide">
                    Crisis activa
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 leading-tight truncate">
                Control de Crisis · Venezuela
              </p>
            </div>
          </div>

          {/* Reloj VET + Salir */}
          <div className="shrink-0 flex items-center gap-3">
            <div className="text-right">
              <p className="text-[11px] font-mono text-gray-500 leading-none">VET</p>
              <p className="text-xs font-mono font-semibold text-gray-800 tabular-nums">
                {clock || "——"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-semibold text-gray-500 hover:text-crisis border border-border hover:border-crisis/40 rounded-lg px-3 py-1.5 transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* ── Tab nav ───────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex items-center gap-1.5 px-4 sm:px-6 py-3.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
              ].join(" ")}
            >
              <span className="text-base">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <main
        className={[
          "flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6",
          activeTab === "triaje"
            ? "py-3 min-h-0 overflow-hidden flex flex-col"
            : "py-6",
        ].join(" ")}
      >
        {activeTab === "ficha"         && <TabFicha />}
        {activeTab === "pacientes"     && (
          <TabPacientes
            key={patientsRefreshKey}
            onOpenPatient={openPatient}
          />
        )}
        {activeTab === "desaparecidos" && <TabDesaparecidos />}
        {activeTab === "encontrados" && (
          <TabEncontrados onOpenPatient={openPatient} />
        )}
        {activeTab === "triaje"        && <TabTriaje />}
        {activeTab === "reportes"      && <TabReportes />}
      </main>

      {selectedPatientId && (
        <PatientModal
          victimId={selectedPatientId}
          onClose={closePatient}
          onUpdated={handlePatientUpdated}
        />
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="bg-gray-800 text-gray-400 text-center py-3 text-xs border-t border-gray-700">
        <p>Sistema Descentralizado · Apoyo SaluPro · Registro de Personas Desaparecidas · Venezuela 2026</p>
        <p className="text-gray-500 mt-0.5">
          Datos guardados localmente para funcionamiento sin conexión estable.
        </p>
        <DevCredit />
      </footer>
    </div>
  );
}
