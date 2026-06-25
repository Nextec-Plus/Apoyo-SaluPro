"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";
import type { MissingPersonStatus } from "@/lib/types/database";

export function StatusActions({
  id,
  estado,
}: {
  id: string;
  estado: MissingPersonStatus;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [ubicacion, setUbicacion] = useState("");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState<MissingPersonStatus | null>(null);
  const [error, setError] = useState("");

  const cerrado = estado === "Encontrado" || estado === "Confirmado Fallecido";

  async function changeStatus(nuevo: MissingPersonStatus, withDetails = false) {
    setError("");
    setLoading(nuevo);
    try {
      const res = await fetch(`/api/missing-persons/${id}/sighting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: nuevo,
          ...(withDetails && ubicacion ? { ubicacion_avistamiento: ubicacion } : {}),
          ...(withDetails && notas ? { notas } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Error al actualizar el estado");
      setOpen(false);
      setUbicacion("");
      setNotas("");
      router.refresh();
      toast.success(
        nuevo === "Avistado"
          ? "Avistamiento reportado"
          : nuevo === "Encontrado"
            ? "Marcada como encontrada"
            : nuevo === "Confirmado Fallecido"
              ? "Estado actualizado"
              : "Reporte reabierto",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  }

  if (cerrado) {
    return (
      <div className="mt-5 rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-gray-600">
          Este reporte está cerrado ({estado}). ¿Hubo un cambio?{" "}
          <button
            onClick={() => changeStatus("Desaparecido")}
            disabled={loading !== null}
            className="font-semibold text-primary hover:underline disabled:opacity-60"
          >
            Reabrir como desaparecida
          </button>
        </p>
        {error && <p className="mt-2 text-xs text-crisis">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display text-lg font-bold mb-1">Actualizar estado</h2>
      <p className="text-sm text-gray-500 mb-4">
        ¿La viste o ya fue encontrada? Ayuda a mantener el registro al día.
      </p>

      <div className="flex flex-wrap gap-2.5">
        {estado !== "Avistado" && (
          <button
            onClick={() => setOpen((v) => !v)}
            disabled={loading !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold px-4 py-2.5 text-sm transition-colors disabled:opacity-60"
          >
            Reportar avistamiento
          </button>
        )}
        <button
          onClick={() => changeStatus("Encontrado")}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 rounded-lg bg-primary hover:bg-primary-dark text-white font-semibold px-4 py-2.5 text-sm transition-colors disabled:opacity-60"
        >
          {loading === "Encontrado" ? "Actualizando…" : "Marcar como encontrada"}
        </button>
        <button
          onClick={() => changeStatus("Confirmado Fallecido")}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 rounded-lg border border-border text-gray-600 hover:bg-muted font-semibold px-4 py-2.5 text-sm transition-colors disabled:opacity-60"
        >
          Confirmar fallecida
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3 rounded-xl bg-muted/60 p-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">¿Dónde la viste?</label>
            <input
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Ej. Refugio Maiquetía"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notas</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Detalles del avistamiento…"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
            />
          </div>
          <button
            onClick={() => changeStatus("Avistado", true)}
            disabled={loading !== null}
            className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-2.5 text-sm transition-colors disabled:opacity-60"
          >
            {loading === "Avistado" ? "Enviando…" : "Enviar avistamiento"}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-crisis">{error}</p>}
    </div>
  );
}
