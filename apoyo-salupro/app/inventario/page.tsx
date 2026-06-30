import { Suspense } from "react";
import { InventarioClient } from "./inventario-client";

export default function InventarioPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-muted flex items-center justify-center text-gray-400 text-sm">
          Cargando…
        </div>
      }
    >
      <InventarioClient />
    </Suspense>
  );
}
