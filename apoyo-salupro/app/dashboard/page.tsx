import { Suspense } from "react";
import { DashboardClient } from "./dashboard-client";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-muted flex items-center justify-center text-gray-400 text-sm">Cargando…</div>}>
      <DashboardClient />
    </Suspense>
  );
}
