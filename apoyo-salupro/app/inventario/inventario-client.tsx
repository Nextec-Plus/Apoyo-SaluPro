"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TabInventario } from "./tab-inventario";
import { TabAdmin } from "./tab-admin";

type Tab = "inventario" | "admin";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "inventario", label: "Inventario", icon: "📦" },
  { id: "admin", label: "Administración", icon: "⚙️" },
];

export function InventarioClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("inventario");
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex flex-col min-h-screen bg-muted">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-border shadow-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Image
              src="/isotipo_salupro_light.png"
              alt="Apoyo SaluPro"
              width={36}
              height={36}
              className="shrink-0"
            />
            <div className="min-w-0">
              <p className="font-display text-xs font-bold text-primary uppercase tracking-widest leading-none">
                Apoyo SaluPro
              </p>
              <p className="text-[11px] text-gray-500 leading-tight truncate">
                Centro de Acopio · Gestión de Inventario
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
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

      {/* ── Tab nav ──────────────────────────────────────────────────── */}
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
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6">
        {activeTab === "inventario" && <TabInventario />}
        {activeTab === "admin" && <TabAdmin />}
      </main>

      <footer className="bg-gray-800 text-gray-400 text-center py-3 text-xs border-t border-gray-700">
        <p>Sistema Descentralizado · Apoyo SaluPro · Centro de Acopio · Venezuela 2026</p>
      </footer>
    </div>
  );
}
