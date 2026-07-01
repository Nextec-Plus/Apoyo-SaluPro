"use client";

import dynamic from "next/dynamic";

/** Carga MapaCalor solo en cliente (usa window/WebGL → ssr:false obligatorio). */
export const MapaCalorDynamic = dynamic(() => import("./mapa-calor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full bg-muted rounded-xl">
      <p className="text-xs text-gray-400">Cargando mapa…</p>
    </div>
  ),
});
