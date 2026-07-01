"use client";

import { useEffect } from "react";
import type { PuntoCalor } from "./mapa-calor";

const ESTADO_STYLE: Record<string, string> = {
  "Pendiente": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "En revisión": "bg-blue-100 text-blue-800 border-blue-200",
  "Aprobado": "bg-primary-light text-primary-dark border-primary/20",
  "Despachado": "bg-teal-100 text-teal-800 border-teal-200",
  "Cerrado": "bg-gray-100 text-gray-500 border-gray-200",
};

function fmtDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseSecciones(raw: unknown): { id?: string; name: string }[] {
  if (!Array.isArray(raw)) return [];
  return (raw as { id?: string; name?: string }[]).filter((s) => !!s?.name) as { id?: string; name: string }[];
}

function FieldIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0 text-gray-400">
      <path d={path} />
    </svg>
  );
}

const ICON = {
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z",
  mail: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM3.5 5.7l8.5 6.5 8.5-6.5",
  id: "M3 6h18v12H3zM7 15c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5M8 10.5h.01M15 9.5h5M15 12.5h5",
  pin: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z",
};

export function SolicitudMapModal({
  puntos,
  onClose,
}: {
  puntos: PuntoCalor[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-modal-fade"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl origin-center animate-modal-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-800">
              {puntos.length === 1 ? "Solicitud" : `${puntos.length} solicitudes en esta zona`}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Registradas con ubicación GPS</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-muted hover:text-gray-700 transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.9]"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-4 h-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="divide-y divide-border">
          {puntos.map((p, i) => {
            const secciones = parseSecciones(p.seccionesSolicitadas);
            return (
              <div key={p.id ?? i} className="px-5 py-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.nombre ?? "Sin nombre"}</p>
                    {p.createdAt && <p className="text-[11px] text-gray-400 mt-0.5">{fmtDate(p.createdAt)}</p>}
                  </div>
                  {p.estado && (
                    <span
                      className={`shrink-0 text-[11px] font-semibold rounded-full border px-2.5 py-0.5 ${
                        ESTADO_STYLE[p.estado] ?? "bg-gray-100 text-gray-600 border-gray-200"
                      }`}
                    >
                      {p.estado}
                    </span>
                  )}
                </div>

                {secciones.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {secciones.map((s, si) => (
                      <span key={s.id ?? `${s.name}-${si}`} className="text-[10px] font-bold rounded-full bg-primary-light text-primary-dark px-2 py-0.5">
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}

                {(p.telefono || p.correo || p.cedulaRif) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                    {p.telefono && (
                      <span className="inline-flex items-center gap-1.5">
                        <FieldIcon path={ICON.phone} /> {p.telefono}
                      </span>
                    )}
                    {p.correo && (
                      <span className="inline-flex items-center gap-1.5">
                        <FieldIcon path={ICON.mail} /> {p.correo}
                      </span>
                    )}
                    {p.cedulaRif && (
                      <span className="inline-flex items-center gap-1.5">
                        <FieldIcon path={ICON.id} /> {p.cedulaRif}
                      </span>
                    )}
                  </div>
                )}

                {p.direccion && (
                  <p className="flex items-start gap-1.5 text-xs text-gray-600 leading-relaxed">
                    <FieldIcon path={ICON.pin} />
                    <span>{p.direccion}</span>
                  </p>
                )}

                {p.notas && (
                  <p className="text-xs text-gray-700 leading-relaxed bg-muted rounded-lg px-3 py-2 whitespace-pre-wrap">
                    {p.notas}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
