"use client";

const COLUMNAS = [
  {
    id:    "verde",
    color: "border-triage-green",
    badge: "bg-triage-green",
    label: "🟢 VERDE",
    sub:   "Leve / Ambulatorio",
    count: 0,
  },
  {
    id:    "amarillo",
    color: "border-triage-yellow",
    badge: "bg-triage-yellow",
    label: "🟡 AMARILLO",
    sub:   "Moderado / Observación",
    count: 0,
  },
  {
    id:    "rojo",
    color: "border-crisis",
    badge: "bg-crisis",
    label: "🔴 ROJO",
    sub:   "Grave / Emergencia Inmediata",
    count: 0,
  },
];

export function TabTriaje() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-6">
      <div className="border-b border-border pb-3 mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Tablero de Triaje</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Gestión visual del flujo de pacientes por nivel de gravedad.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
          🚧 En construcción
        </span>
      </div>

      {/* Banner informativo */}
      <div className="bg-primary-light border border-primary/20 rounded-lg px-4 py-3 mb-6 flex items-start gap-3">
        <span className="text-2xl mt-0.5">🏗️</span>
        <div>
          <p className="text-sm font-semibold text-primary">
            Módulo de Triaje — Implementación en progreso
          </p>
          <p className="text-xs text-primary/70 mt-0.5">
            Este módulo está siendo desarrollado por el equipo de backend. El tablero Kanban
            mostrará los pacientes clasificados en tiempo real con capacidad de arrastrar y soltar.
          </p>
        </div>
      </div>

      {/* Kanban skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNAS.map((col) => (
          <div
            key={col.id}
            className={`rounded-xl border-2 ${col.color} bg-muted overflow-hidden`}
          >
            {/* Column header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-border">
              <div>
                <p className="text-sm font-bold text-gray-800">{col.label}</p>
                <p className="text-[11px] text-gray-500">{col.sub}</p>
              </div>
              <span className={`${col.badge} text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center`}>
                {col.count}
              </span>
            </div>

            {/* Empty column placeholder */}
            <div className="px-4 py-6 flex flex-col items-center justify-center gap-2 min-h-[200px]">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xl">
                +
              </div>
              <p className="text-xs text-gray-400 text-center">
                Las tarjetas de pacientes<br />aparecerán aquí
              </p>
            </div>

            {/* Skeleton cards */}
            <div className="px-4 pb-4 space-y-2 opacity-30">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-lg border border-border p-3 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-2 bg-gray-200 rounded w-1/2" />
                  <div className="h-2 bg-gray-200 rounded w-2/3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Features list */}
      <div className="mt-6 bg-muted rounded-lg border border-border p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
          Funciones planificadas
        </p>
        <ul className="space-y-1.5 text-sm text-gray-600">
          {[
            "Drag & drop de pacientes entre columnas de triaje",
            "Contador de pacientes por categoría en tiempo real",
            "Integración con registros de Ficha Médica",
            "Historial de cambios de estado por paciente",
            "Alertas de pacientes en estado crítico prolongado",
            "Exportación a hoja de cálculo / Google Sheets",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2">
              <span className="text-primary text-xs">○</span>
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
