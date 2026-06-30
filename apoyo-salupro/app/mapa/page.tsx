"use client";

import { useEffect, useState } from "react";
import { MapaCalorDynamic } from "@/app/inventario/mapa-calor-dynamic";
import type { PuntoCalor } from "@/app/inventario/mapa-calor";
import Link from "next/link";

export default function MapaFullscreenPage() {
  const [puntos, setPuntos] = useState<PuntoCalor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mapa/geo-points", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        setPuntos(json.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {loading ? (
        <div className="flex items-center justify-center w-full h-full bg-muted">
          <p className="text-xs text-gray-400">Cargando mapa…</p>
        </div>
      ) : (
        <MapaCalorDynamic puntos={puntos} className="w-full h-full" />
      )}
      <Link
        href="/"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur border border-border rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-lg hover:text-primary hover:border-primary/40 transition-colors"
      >
        ← Volver al inicio
      </Link>
    </div>
  );
}
