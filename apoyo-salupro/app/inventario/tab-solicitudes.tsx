"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupplyRequest, SupplyRequestStatus } from "@/lib/types/database";

/* ── Config ──────────────────────────────────────────────────────────────── */
const ALL_ESTADOS: SupplyRequestStatus[] = [
  "Pendiente", "En revisión", "Aprobado", "Despachado", "Cerrado",
];

const ESTADO_STYLE: Record<SupplyRequestStatus, string> = {
  "Pendiente":   "bg-yellow-100 text-yellow-800 border-yellow-200",
  "En revisión": "bg-blue-100 text-blue-800 border-blue-200",
  "Aprobado":    "bg-primary-light text-primary-dark border-primary/20",
  "Despachado":  "bg-teal-100 text-teal-800 border-teal-200",
  "Cerrado":     "bg-gray-100 text-gray-500 border-gray-200",
};

const TIPO_STYLE: Record<string, string> = {
  "Persona":             "bg-purple-100 text-purple-800",
  "Clínica / Hospital":  "bg-blue-100 text-blue-800",
  "Centro de acopio":    "bg-orange-100 text-orange-800",
};

/* ── Categoría seleccionada shape ──────────────────────────────────────────── */
interface SelSubcat { id: string; name: string; code: string }
interface SectionItem {
  id: string;
  name: string;
  code: string;
  selectedSubcats?: SelSubcat[];
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseSecciones(raw: unknown): SectionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw as SectionItem[];
}

/* ── Stat Card ───────────────────────────────────────────────────────────── */
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${color}`}>
      <div className="font-display text-3xl font-extrabold">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}

/* ── Request Card ────────────────────────────────────────────────────────── */
function RequestCard({
  req,
  onChangeEstado,
}: {
  req: SupplyRequest;
  onChangeEstado: (id: string, e: SupplyRequestStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const secciones = parseSecciones(req.secciones_solicitadas);
  const hasGps = req.latitud !== null && req.longitud !== null;
  const mapsUrl = hasGps
    ? `https://www.google.com/maps?q=${req.latitud},${req.longitud}`
    : null;

  return (
    <div className="rounded-2xl border border-border bg-white overflow-hidden transition-shadow hover:shadow-md">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{req.nombre}</span>
            <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${TIPO_STYLE[req.tipo_solicitante] ?? "bg-gray-100 text-gray-600"}`}>
              {req.tipo_solicitante}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{fmtDate(req.created_at)}</p>
        </div>

        {/* Estado selector */}
        <select
          value={req.estado}
          onChange={(e) => onChangeEstado(req.id, e.target.value as SupplyRequestStatus)}
          className={`text-xs font-semibold rounded-full border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-ring cursor-pointer ${ESTADO_STYLE[req.estado]}`}
        >
          {ALL_ESTADOS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-3">
        {/* Secciones + subcategorías */}
        {secciones.length > 0 && (
          <div className="space-y-1.5">
            {secciones.map((s) => (
              <div key={s.id}>
                <span className="text-[11px] font-bold rounded-full bg-primary-light text-primary-dark px-2.5 py-0.5">
                  {s.name}
                </span>
                {s.selectedSubcats && s.selectedSubcats.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 ml-2">
                    {s.selectedSubcats.map((sc) => (
                      <span key={sc.id} className="text-[10px] font-medium rounded-full bg-muted border border-border text-gray-600 px-2 py-0.5">
                        {sc.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Contacto */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600">
          <span>📞 {req.telefono}</span>
          {req.correo && <span>✉️ {req.correo}</span>}
          {req.cedula_rif && <span>🪪 {req.cedula_rif}</span>}
        </div>

        {/* Ubicación */}
        {(req.direccion || hasGps) && (
          <div className="flex items-start gap-2 text-xs text-gray-600">
            <span className="shrink-0">📍</span>
            <span className="leading-relaxed">
              {req.direccion}
              {hasGps && (
                <>
                  {req.direccion && " · "}
                  <a
                    href={mapsUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-semibold"
                  >
                    Ver en mapa ({req.latitud?.toFixed(4)}, {req.longitud?.toFixed(4)})
                  </a>
                </>
              )}
            </span>
          </div>
        )}

        {/* Notas */}
        {req.notas && (
          <div>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors"
            >
              {expanded ? "▲ Ocultar notas" : "▼ Ver notas"}
            </button>
            {expanded && (
              <p className="mt-2 text-xs text-gray-700 leading-relaxed bg-muted rounded-xl px-4 py-3 whitespace-pre-wrap">
                {req.notas}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────────────── */
export function TabSolicitudes() {
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterEstado, setFilterEstado] = useState<SupplyRequestStatus | "">("");
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (filterEstado) params.set("estado", filterEstado);
      const res = await fetch(`/api/supply-requests?${params}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error);
      setRequests(json.data ?? []);
      setTotal(json.count ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar solicitudes.");
    } finally {
      setLoading(false);
    }
  }, [filterEstado, page]);

  useEffect(() => { load(); }, [load]);

  const handleChangeEstado = async (id: string, estado: SupplyRequestStatus) => {
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, estado } : r));
    try {
      const res = await fetch(`/api/supply-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      if (!res.ok) throw new Error();
    } catch {
      load(); // revert on error
    }
  };

  /* Stats from current data */
  const counts = ALL_ESTADOS.reduce((acc, e) => {
    acc[e] = requests.filter((r) => r.estado === e).length;
    return acc;
  }, {} as Record<SupplyRequestStatus, number>);

  return (
    <div className="space-y-6">
      {/* ── Header + stats ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-xl font-bold text-gray-900">Solicitudes de insumos</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {loading ? "Cargando…" : `${total} solicitud${total !== 1 ? "es" : ""} en total`}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="text-xs font-semibold text-gray-500 hover:text-primary border border-border rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            ↻ Actualizar
          </button>
        </div>

        {/* Stat pills */}
        <div className="flex flex-wrap gap-2">
          {ALL_ESTADOS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => { setFilterEstado(filterEstado === e ? "" : e); setPage(1); }}
              className={[
                "text-xs font-semibold rounded-full border px-3 py-1.5 transition-colors",
                filterEstado === e
                  ? ESTADO_STYLE[e]
                  : "border-border bg-white text-gray-600 hover:border-primary/40",
              ].join(" ")}
            >
              {e} ({counts[e]})
            </button>
          ))}
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────── */}
      {error && (
        <p className="rounded-xl border border-crisis/30 bg-crisis-light text-crisis text-sm px-4 py-3">
          {error}
        </p>
      )}

      {/* ── Lista ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-white h-36 animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white text-center py-16">
          <p className="text-3xl mb-3">📋</p>
          <p className="font-semibold text-gray-700">
            {filterEstado ? `Sin solicitudes en estado "${filterEstado}"` : "No hay solicitudes todavía"}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Aparecerán aquí cuando alguien use el formulario público.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <RequestCard key={req.id} req={req} onChangeEstado={handleChangeEstado} />
          ))}
        </div>
      )}

      {/* ── Paginación ─────────────────────────────────────────── */}
      {total > LIMIT && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-sm text-gray-500">
            Página {page} de {Math.ceil(total / LIMIT)}
          </span>
          <button
            disabled={page >= Math.ceil(total / LIMIT)}
            onClick={() => setPage((p) => p + 1)}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
