"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast-provider";
import { TRIAGE_UPDATED_EVENT } from "@/lib/events";
import type { CareState, CatastropheVictim, CatastropheVictimInfo, TriageCategory } from "@/lib/types/database";

type TriageCase = CatastropheVictimInfo & {
  catastrophe_victims: CatastropheVictim | null;
};

const COLUMNAS = [
  {
    id: "Verde" as const,
    color: "border-triage-green",
    badge: "bg-triage-green",
    dropHighlight: "ring-2 ring-triage-green/40 bg-green-50/80",
    label: "🟢 VERDE",
    sub: "Leve / Ambulatorio",
  },
  {
    id: "Amarillo" as const,
    color: "border-triage-yellow",
    badge: "bg-triage-yellow",
    dropHighlight: "ring-2 ring-triage-yellow/40 bg-amber-50/80",
    label: "🟡 AMARILLO",
    sub: "Moderado / Observación",
  },
  {
    id: "Rojo" as const,
    color: "border-crisis",
    badge: "bg-crisis",
    dropHighlight: "ring-2 ring-crisis/40 bg-red-50/80",
    label: "🔴 ROJO",
    sub: "Grave / Emergencia Inmediata",
  },
] as const;

type ColumnId = (typeof COLUMNAS)[number]["id"];

const COLUMN_IDS = new Set<string>(COLUMNAS.map((c) => c.id));

function isColumnId(value: string | undefined | null): value is ColumnId {
  return value != null && COLUMN_IDS.has(value);
}

function columnAtPoint(clientX: number, clientY: number): ColumnId | null {
  const el = document.elementFromPoint(clientX, clientY);
  const col = el?.closest("[data-triage-column]") as HTMLElement | null;
  const id = col?.dataset.triageColumn;
  return isColumnId(id) ? id : null;
}

function formatEntrada(iso: string) {
  return new Date(iso).toLocaleString("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ESTADO_STYLES: Record<CareState, string> = {
  Triaje: "bg-gray-100 text-gray-700 border-gray-200",
  "En Atención": "bg-amber-50 text-amber-800 border-amber-200",
  Hospitalizado: "bg-red-50 text-crisis border-crisis/20",
  Transferido: "bg-blue-50 text-blue-800 border-blue-200",
  "Alta Médica": "bg-green-50 text-triage-green border-triage-green/30",
  Anulado: "bg-gray-100 text-gray-400 border-gray-200 line-through",
};

function patientStatus(caso: TriageCase): { label: string; careState: CareState } {
  const destino = caso.catastrophe_victims?.notas?.trim();
  if (destino) {
    return { label: destino, careState: caso.estado_destino };
  }
  return { label: caso.estado_destino, careState: caso.estado_destino };
}

function categoryShort(id: TriageCategory): string {
  if (id === "Verde") return "🟢 Verde";
  if (id === "Amarillo") return "🟡 Amarillo";
  return "🔴 Rojo";
}

type PendingMoveUI = {
  patientName: string;
  from: TriageCategory;
  target: TriageCategory;
};

function PatientCard({
  caso,
  isDragging,
  pendingMove,
  onDragStart,
  onDragEnd,
  onMoveTo,
}: {
  caso: TriageCase;
  isDragging: boolean;
  pendingMove?: PendingMoveUI;
  onDragStart: (caseId: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onMoveTo: (caseId: string, category: ColumnId) => void;
}) {
  const victim = caso.catastrophe_victims;
  const status = patientStatus(caso);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(caso.id, e)}
      onDragEnd={onDragEnd}
      className={[
        "bg-white rounded-lg border border-border p-3 shadow-sm space-y-2",
        "cursor-grab active:cursor-grabbing select-none",
        "hover:border-primary/40 hover:shadow-md transition-[opacity,transform,box-shadow]",
        isDragging ? "opacity-50 scale-[0.98]" : "",
        pendingMove ? "ring-2 ring-primary/25 border-primary/30" : "",
      ].join(" ")}
    >
      {pendingMove && (
        <div
          className="flex items-center gap-2 rounded-md bg-primary/10 border border-primary/20 px-2.5 py-2 -mx-0.5"
          role="status"
          aria-live="polite"
        >
          <span
            className="inline-block w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0"
            aria-hidden
          />
          <p className="text-[11px] font-semibold text-primary leading-snug">
            Trasladando de {categoryShort(pendingMove.from)} a{" "}
            {categoryShort(pendingMove.target)}…
          </p>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-gray-900 leading-tight">
          {victim?.nombre_completo ?? "Sin nombre"}
        </p>
        {victim?.cedula && (
          <p className="text-[11px] text-gray-500 font-mono mt-0.5">{victim.cedula}</p>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Consulta
        </p>
        <p className="text-xs text-gray-700 leading-snug line-clamp-3">
          {caso.motivo_principal_consulta?.trim() || "Sin sintomatología registrada"}
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Estatus
        </p>
        <span
          className={[
            "inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border leading-snug",
            ESTADO_STYLES[status.careState],
          ].join(" ")}
        >
          {status.label}
        </span>
      </div>

      <div className="flex items-center justify-between pt-0.5">
        <span className="text-[10px] text-gray-400 uppercase tracking-wide">
          {victim?.sector_comunidad ?? "—"}
        </span>
        <span className="text-[10px] text-gray-400 tabular-nums">
          {formatEntrada(caso.fecha_hora_entrada)}
        </span>
      </div>

      <div className="flex gap-1 pt-1.5 border-t border-border/60">
        {COLUMNAS.map((col) => (
          <button
            key={col.id}
            type="button"
            disabled={caso.triage_category === col.id}
            onClick={() => onMoveTo(caso.id, col.id)}
            onPointerDown={(e) => e.stopPropagation()}
            title={`Mover a ${col.id}`}
            className={[
              "flex-1 text-[10px] font-bold py-1 rounded border transition-colors disabled:opacity-40",
              caso.triage_category === col.id
                ? `${col.badge} text-white border-transparent`
                : "bg-white text-gray-500 border-border hover:border-gray-400",
            ].join(" ")}
          >
            {col.id === "Verde" ? "V" : col.id === "Amarillo" ? "A" : "R"}
          </button>
        ))}
      </div>
    </div>
  );
}

type PendingMove = {
  target: TriageCategory;
  confirmed: TriageCategory;
  timer: ReturnType<typeof setTimeout>;
  patientName: string;
};

const PATCH_DEBOUNCE_MS = 350;

export function TabTriaje() {
  const toast = useToast();
  const [cases, setCases] = useState<TriageCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);
  const [pendingMovesUI, setPendingMovesUI] = useState<
    Map<string, PendingMoveUI>
  >(() => new Map());

  const casesRef = useRef(cases);
  casesRef.current = cases;

  const draggingCaseIdRef = useRef<string | null>(null);
  const dragOverColumnRef = useRef<ColumnId | null>(null);
  const dropHandledRef = useRef(false);
  const pendingMovesRef = useRef<Map<string, PendingMove>>(new Map());
  const loadInFlightRef = useRef(false);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const loadCases = useCallback(async (isRefresh = false, silent = false) => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/catastrophe/triage-board");
      const json = await res.json();

      if (!res.ok || json.error) {
        const msg = json.error ?? "No se pudo cargar el tablero de triaje";
        if (!silent) toastRef.current.error(msg);
        setCases([]);
        return;
      }

      const serverCases: TriageCase[] = json.data ?? [];
      setCases((prev) => {
        if (pendingMovesRef.current.size === 0) return serverCases;

        const pendingTargets = new Map<string, TriageCategory>();
        for (const [id, move] of pendingMovesRef.current) {
          pendingTargets.set(id, move.target);
        }

        const serverById = new Map(serverCases.map((c) => [c.id, c]));
        const merged: TriageCase[] = [];

        for (const serverCase of serverCases) {
          const target = pendingTargets.get(serverCase.id);
          merged.push(
            target != null
              ? { ...serverCase, triage_category: target }
              : serverCase,
          );
          pendingTargets.delete(serverCase.id);
        }

        for (const [id, target] of pendingTargets) {
          const local = prev.find((c) => c.id === id) ?? serverById.get(id);
          if (local) merged.push({ ...local, triage_category: target });
        }

        return merged;
      });
      if (isRefresh && !silent) toastRef.current.success("Tablero de triaje actualizado");
    } catch {
      if (!silent) toastRef.current.error("Error de conexión al cargar pacientes en triaje");
      setCases([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadCases(false, true);
    const interval = setInterval(() => loadCases(true, true), 30_000);
    const onTriageUpdated = () => loadCases(true, true);
    window.addEventListener(TRIAGE_UPDATED_EVENT, onTriageUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener(TRIAGE_UPDATED_EVENT, onTriageUpdated);
      for (const pending of pendingMovesRef.current.values()) {
        clearTimeout(pending.timer);
      }
      pendingMovesRef.current.clear();
    };
  }, [loadCases]);

  const applyCategory = useCallback((caseId: string, category: TriageCategory) => {
    setCases((prev) => {
      const current = prev.find((c) => c.id === caseId);
      if (!current || current.triage_category === category) return prev;
      return prev.map((c) =>
        c.id === caseId ? { ...c, triage_category: category } : c,
      );
    });
  }, []);

  const clearPending = useCallback((caseId: string) => {
    pendingMovesRef.current.delete(caseId);
    setPendingMovesUI((prev) => {
      if (!prev.has(caseId)) return prev;
      const next = new Map(prev);
      next.delete(caseId);
      return next;
    });
  }, []);

  const updatePendingUI = useCallback(
    (
      caseId: string,
      info: { patientName: string; from: TriageCategory; target: TriageCategory },
    ) => {
      setPendingMovesUI((prev) => {
        const next = new Map(prev);
        next.set(caseId, info);
        return next;
      });
    },
    [],
  );

  const flushPatch = useCallback(
    async (caseId: string) => {
      const pending = pendingMovesRef.current.get(caseId);
      if (!pending) return;

      const { target, confirmed, patientName } = pending;
      if (target === confirmed) {
        clearPending(caseId);
        return;
      }

      try {
        const res = await fetch(`/api/catastrophe/cases/${caseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ triage_category: target }),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error ?? "No se pudo actualizar la categoría");
        }

        const latest = pendingMovesRef.current.get(caseId);
        if (!latest) return;

        latest.confirmed = target;

        if (latest.target !== target) {
          latest.timer = setTimeout(() => void flushPatch(caseId), PATCH_DEBOUNCE_MS);
          return;
        }

        clearPending(caseId);
        toastRef.current.success(`${patientName} → ${target}`);
      } catch (err) {
        applyCategory(caseId, confirmed);
        clearPending(caseId);
        toastRef.current.error(
          err instanceof Error ? err.message : "Error al mover el paciente",
        );
      }
    },
    [applyCategory, clearPending],
  );

  const moveCase = useCallback(
    (caseId: string, newCategory: TriageCategory) => {
      const current = casesRef.current.find((c) => c.id === caseId);
      if (!current || current.triage_category === newCategory) return;

      const patientName =
        current.catastrophe_victims?.nombre_completo ?? "Paciente";

      const existing = pendingMovesRef.current.get(caseId);
      const fromCategory = existing?.confirmed ?? current.triage_category;

      applyCategory(caseId, newCategory);
      updatePendingUI(caseId, {
        patientName,
        from: fromCategory,
        target: newCategory,
      });

      if (existing) {
        clearTimeout(existing.timer);
        existing.target = newCategory;
        existing.timer = setTimeout(() => void flushPatch(caseId), PATCH_DEBOUNCE_MS);
        return;
      }

      pendingMovesRef.current.set(caseId, {
        target: newCategory,
        confirmed: current.triage_category,
        patientName,
        timer: setTimeout(() => void flushPatch(caseId), PATCH_DEBOUNCE_MS),
      });
    },
    [applyCategory, flushPatch, updatePendingUI],
  );

  const handleDragStart = useCallback((caseId: string, e: React.DragEvent) => {
    dropHandledRef.current = false;
    draggingCaseIdRef.current = caseId;
    e.dataTransfer.setData("text/plain", caseId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(caseId);
  }, []);

  const handleBoardDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    const col = columnAtPoint(e.clientX, e.clientY);
    if (col && col !== dragOverColumnRef.current) {
      dragOverColumnRef.current = col;
      setDragOverColumn(col);
    }
  }, []);

  const handleColumnDrop = useCallback(
    (e: React.DragEvent, columnId: ColumnId) => {
      e.preventDefault();
      e.stopPropagation();
      if (dropHandledRef.current) return;
      dropHandledRef.current = true;

      const caseId =
        draggingCaseIdRef.current ||
        e.dataTransfer.getData("text/plain") ||
        null;
      const targetColumn =
        columnAtPoint(e.clientX, e.clientY) ?? columnId;

      draggingCaseIdRef.current = null;
      dragOverColumnRef.current = null;
      setDragOverColumn(null);
      setDraggingId(null);

      if (caseId && targetColumn) {
        moveCase(caseId, targetColumn);
      }

      requestAnimationFrame(() => {
        dropHandledRef.current = false;
      });
    },
    [moveCase],
  );

  const handleDragEnd = useCallback(() => {
    window.setTimeout(() => {
      if (dropHandledRef.current) return;
      draggingCaseIdRef.current = null;
      dragOverColumnRef.current = null;
      setDragOverColumn(null);
      setDraggingId(null);
    }, 0);
  }, []);

  const byCategory = (category: ColumnId) =>
    cases.filter((c) => c.triage_category === category);

  const pendingList = Array.from(pendingMovesUI.entries());

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-6">
      <div className="border-b border-border pb-3 mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Tablero de Triaje</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Arrastra las tarjetas entre columnas para reclasificar pacientes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadCases(true)}
          disabled={refreshing}
          className="shrink-0 text-xs font-semibold text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary-light transition-colors disabled:opacity-50"
        >
          {refreshing ? "Actualizando…" : "↻ Actualizar"}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNAS.map((col) => (
            <div
              key={col.id}
              className={`rounded-xl border-2 ${col.color} bg-muted p-4 min-h-[240px] animate-pulse`}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNAS.map((col) => {
            const items = byCategory(col.id);
            const isDropTarget = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                data-triage-column={col.id}
                onDragOver={handleBoardDragOver}
                onDrop={(e) => handleColumnDrop(e, col.id)}
                className={[
                  "relative rounded-xl border-2 bg-muted overflow-hidden transition-shadow",
                  col.color,
                  isDropTarget ? col.dropHighlight : "",
                ].join(" ")}
              >
                <div className="px-4 py-3 flex items-center justify-between border-b border-border bg-white/60">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{col.label}</p>
                    <p className="text-[11px] text-gray-500">{col.sub}</p>
                  </div>
                  <span
                    className={`${col.badge} text-white text-xs font-bold rounded-full min-w-6 h-6 px-1.5 flex items-center justify-center`}
                  >
                    {items.length}
                  </span>
                </div>

                <div className="relative px-3 py-3 space-y-2 min-h-[200px]">
                  {isDropTarget && (
                    <div className="pointer-events-none absolute inset-2 z-20 rounded-lg border-2 border-dashed border-primary/40 flex items-center justify-center">
                      <span className="text-xs font-semibold text-primary bg-white/90 px-2 py-1 rounded shadow-sm">
                        Soltar en {col.id}
                      </span>
                    </div>
                  )}

                  {items.length === 0 && !isDropTarget && (
                    <p className="text-xs text-gray-400 text-center py-8">
                      Sin pacientes en esta categoría
                    </p>
                  )}

                  {items.map((caso) => (
                    <PatientCard
                      key={caso.id}
                      caso={caso}
                      isDragging={draggingId === caso.id}
                      pendingMove={pendingMovesUI.get(caso.id)}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onMoveTo={moveCase}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pendingList.length > 0 && (
        <div
          className="mt-4 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3"
          role="status"
          aria-live="polite"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-2">
            <span
              className="inline-block w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"
              aria-hidden
            />
            Traslados en curso
          </p>
          <ul className="space-y-1.5">
            {pendingList.map(([id, move]) => (
              <li key={id} className="text-sm text-gray-700">
                <span className="font-semibold text-gray-900">{move.patientName}</span>
                <span className="text-gray-500">
                  {" "}
                  — de {categoryShort(move.from)} a {categoryShort(move.target)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && cases.length === 0 && (
        <p className="mt-4 text-center text-xs text-gray-400">
          No hay pacientes registrados en triaje. Los ingresos desde Ficha Médica aparecerán aquí.
        </p>
      )}
    </div>
  );
}
