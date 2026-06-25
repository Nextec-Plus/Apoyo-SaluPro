"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { TabFicha }        from "./tabs/tab-ficha";
import { TabDesaparecidos } from "./tabs/tab-desaparecidos";
import { TabTriaje }       from "./tabs/tab-triaje";

type Tab = "ficha" | "desaparecidos" | "triaje";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "ficha",         label: "Ficha Médica",         icon: "📋" },
  { id: "desaparecidos", label: "Personas Desaparecidas", icon: "🔍" },
  { id: "triaje",        label: "Triaje",               icon: "🏥" },
];

export function DashboardClient() {
  const [activeTab, setActiveTab] = useState<Tab>("ficha");
  const [clock, setClock]         = useState("");

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-muted">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-border shadow-sm sticky top-0 z-50">
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
              <p className="text-xs font-bold text-primary uppercase tracking-widest leading-none">
                Apoyo SaluPro
              </p>
              <p className="text-[11px] text-gray-500 leading-tight truncate">
                Control de Crisis · La Guaira
              </p>
            </div>
          </div>

          {/* Indicador de crisis */}
          <div className="hidden sm:flex items-center gap-2 bg-crisis-light border border-crisis/20 rounded-full px-3 py-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-crisis animate-pulse" />
            <span className="text-[11px] font-semibold text-crisis uppercase tracking-wide">
              Crisis activa
            </span>
          </div>

          {/* Reloj VET */}
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-mono text-gray-500 leading-none">VET</p>
            <p className="text-xs font-mono font-semibold text-gray-800 tabular-nums">
              {clock || "——"}
            </p>
          </div>
        </div>
      </header>

      {/* ── Crisis banner ─────────────────────────────────────────────── */}
      <div className="bg-crisis">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-2">
          <span className="text-white text-xs font-semibold">
            🔴 TERREMOTO LA GUAIRA — 25 JUN 2026 · Unidad de Clínica Móvil y Registro de Damnificados
          </span>
        </div>
      </div>

      {/* ── Tab nav ───────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-border sticky top-[64px] z-40">
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
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6">
        {activeTab === "ficha"         && <TabFicha />}
        {activeTab === "desaparecidos" && <TabDesaparecidos />}
        {activeTab === "triaje"        && <TabTriaje />}
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="bg-gray-800 text-gray-400 text-center py-3 text-xs border-t border-gray-700">
        <p>Sistema Local Descentralizado · Apoyo SaluPro · Emergencias La Guaira 2026</p>
        <p className="text-gray-500 mt-0.5">
          Datos guardados localmente para funcionamiento sin conexión estable.
        </p>
      </footer>
    </div>
  );
}
