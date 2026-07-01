"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast-provider";
import { getClientOrganizationId } from "@/lib/config";
import type { AyudaEntrega, AyudaEntregaItem, AyudaTipoCatalogo } from "@/lib/types/database";

const inputCls =
  "w-full text-sm bg-white border border-border rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-colors";

const labelCls = "block text-xs font-semibold text-gray-700 mb-1";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

type ItemWithTipo = AyudaEntregaItem & { ayuda_tipos: Pick<AyudaTipoCatalogo, "id" | "nombre"> | null };
type EntregaRow = AyudaEntrega & { ayuda_entrega_items: ItemWithTipo[] };

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function AyudasBadges({ items }: { items: ItemWithTipo[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it) => (
        <span
          key={it.id}
          className="inline-block text-[11px] font-semibold bg-primary-light text-primary-dark rounded-full px-2 py-0.5 whitespace-nowrap"
        >
          {it.cantidad}× {it.ayuda_tipos?.nombre ?? "—"}
        </span>
      ))}
    </div>
  );
}

type SubView = "registrar" | "entregadas";

export function TabAyudas() {
  const toast = useToast();
  const [subView, setSubView] = useState<SubView>("registrar");

  /* ── Catálogo de tipos de ayuda ────────────────────────────────────── */
  const [tipos, setTipos] = useState<AyudaTipoCatalogo[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(true);

  const loadTipos = useCallback(async () => {
    setLoadingTipos(true);
    try {
      const organization_id = getClientOrganizationId();
      const res = await fetch(`/api/catastrophe/ayuda-tipos?organization_id=${organization_id}`, { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setTipos(json.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el catálogo de ayudas");
    } finally {
      setLoadingTipos(false);
    }
  }, [toast]);

  useEffect(() => { loadTipos(); }, [loadTipos]);

  /* ── Form state ────────────────────────────────────────────────────── */
  const [cedula, setCedula] = useState("");
  const [nombre, setNombre] = useState("");
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [historial, setHistorial] = useState<EntregaRow[]>([]);
  const [checking, setChecking] = useState(false);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Crear / editar tipo de ayuda ──────────────────────────────────── */
  const [addingTipo, setAddingTipo] = useState(false);
  const [nuevoTipoNombre, setNuevoTipoNombre] = useState("");
  const [savingTipo, setSavingTipo] = useState(false);
  const [editingTipoId, setEditingTipoId] = useState<string | null>(null);
  const [editTipoNombre, setEditTipoNombre] = useState("");

  const crearTipo = async () => {
    const nombreTipo = nuevoTipoNombre.trim();
    if (!nombreTipo) return;
    setSavingTipo(true);
    try {
      const organization_id = getClientOrganizationId();
      const res = await fetch("/api/catastrophe/ayuda-tipos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id, nombre: nombreTipo }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "No se pudo crear la ayuda");
      toast.success(`Tipo de ayuda "${json.data.nombre}" creado`);
      setNuevoTipoNombre("");
      setAddingTipo(false);
      await loadTipos();
      setCantidades((prev) => ({ ...prev, [json.data.id]: "1" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSavingTipo(false);
    }
  };

  const guardarEdicionTipo = async (id: string) => {
    const nombreTipo = editTipoNombre.trim();
    if (!nombreTipo) { setEditingTipoId(null); return; }
    setSavingTipo(true);
    try {
      const res = await fetch(`/api/catastrophe/ayuda-tipos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreTipo }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "No se pudo renombrar la ayuda");
      toast.success(`Renombrado a "${json.data.nombre}"`);
      setEditingTipoId(null);
      await loadTipos();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSavingTipo(false);
    }
  };

  const toggleAyuda = (tipoId: string) => {
    setCantidades((prev) => {
      if (tipoId in prev) {
        const next = { ...prev };
        delete next[tipoId];
        return next;
      }
      return { ...prev, [tipoId]: "1" };
    });
  };

  const setCantidad = (tipoId: string, value: string) => {
    setCantidades((prev) => ({ ...prev, [tipoId]: value }));
  };

  /* ── Chequeo de cédula repetida (debounced) ───────────────────────────── */
  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (!cedula) { setHistorial([]); return; }

    checkTimer.current = setTimeout(async () => {
      setChecking(true);
      try {
        const organization_id = getClientOrganizationId();
        const res = await fetch(
          `/api/catastrophe/ayudas/check?organization_id=${organization_id}&cedula=${cedula}`,
          { cache: "no-store" },
        );
        const json = await res.json();
        setHistorial(json.error ? [] : json.data ?? []);
      } catch {
        setHistorial([]);
      } finally {
        setChecking(false);
      }
    }, 400);

    return () => { if (checkTimer.current) clearTimeout(checkTimer.current); };
  }, [cedula]);

  /* ── Tabla de registros ────────────────────────────────────────────── */
  const [rows, setRows] = useState<EntregaRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [searchCedula, setSearchCedula] = useState("");
  const [searchNombre, setSearchNombre] = useState("");
  const [filterTipoId, setFilterTipoId] = useState("");

  const loadRows = useCallback(async (filtros?: { cedula?: string; nombre?: string; tipoId?: string }) => {
    setLoadingRows(true);
    try {
      const organization_id = getClientOrganizationId();
      const params = new URLSearchParams({ organization_id, limit: "50" });
      if (filtros?.cedula) params.set("cedula", filtros.cedula);
      if (filtros?.nombre) params.set("nombre", filtros.nombre);
      if (filtros?.tipoId) params.set("tipo_id", filtros.tipoId);
      const res = await fetch(`/api/catastrophe/ayudas?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRows(json.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los registros");
    } finally {
      setLoadingRows(false);
    }
  }, [toast]);

  useEffect(() => { loadRows(); }, [loadRows]);

  useEffect(() => {
    const t = setTimeout(
      () => loadRows({ cedula: searchCedula || undefined, nombre: searchNombre || undefined, tipoId: filterTipoId || undefined }),
      350,
    );
    return () => clearTimeout(t);
  }, [searchCedula, searchNombre, filterTipoId, loadRows]);

  const seleccionadas = useMemo(
    () => tipos.filter((t) => t.id in cantidades),
    [tipos, cantidades],
  );

  const puedeGuardar =
    cedula.length > 0 &&
    nombre.trim().length > 0 &&
    seleccionadas.length > 0 &&
    seleccionadas.every((t) => Number(cantidades[t.id]) > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeGuardar) return toast.error("Complete cédula, nombre y al menos una ayuda con cantidad válida.");

    setSubmitting(true);
    try {
      const organization_id = getClientOrganizationId();
      const items = seleccionadas.map((t) => ({ tipo_id: t.id, cantidad: Number(cantidades[t.id]) }));
      const res = await fetch("/api/catastrophe/ayudas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id,
          cedula,
          nombre_completo: nombre.trim(),
          items,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "No se pudo registrar la ayuda");

      const resumen = seleccionadas.map((t) => `${cantidades[t.id]}× ${t.nombre}`).join(" · ");
      toast.success(`Ayuda registrada para ${nombre.trim()}: ${resumen}`);

      setCedula("");
      setNombre("");
      setCantidades({});
      setHistorial([]);
      loadRows({ cedula: searchCedula || undefined, nombre: searchNombre || undefined, tipoId: filterTipoId || undefined });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  const subViewOpts: { v: SubView; label: string }[] = [
    { v: "registrar", label: "Registrar ayuda" },
    { v: "entregadas", label: "Ayudas entregadas" },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-4 sm:p-6">
      <div className="border-b border-border pb-3 mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Ayudas Humanitarias</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Registro de alimentos, higiene y otros insumos entregados por cédula.
          </p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1 overflow-x-auto no-scrollbar">
          {subViewOpts.map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setSubView(opt.v)}
              className={`shrink-0 whitespace-nowrap text-sm font-semibold px-3.5 py-1.5 rounded-md transition-colors ${
                subView === opt.v ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {subView === "registrar" && (
        <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Cédula</label>
              <input
                inputMode="numeric"
                value={cedula}
                onChange={(e) => setCedula(onlyDigits(e.target.value))}
                placeholder="00000000"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Nombre completo</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre y apellido"
                className={inputCls}
              />
            </div>
          </div>

          {checking && (
            <p className="text-xs text-gray-400">Verificando historial de la cédula…</p>
          )}
          {!checking && historial.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-amber-800">
                Esta cédula ya tiene {historial.length} registro{historial.length === 1 ? "" : "s"} de ayuda previo{historial.length === 1 ? "" : "s"}. Puede continuar y guardar de todos modos.
              </p>
              <div className="space-y-1">
                {historial.slice(0, 3).map((h) => (
                  <div key={h.id} className="flex flex-wrap items-center gap-2 text-[11px] text-amber-700">
                    <span className="font-mono">{fmtFecha(h.created_at)}</span>
                    <AyudasBadges items={h.ayuda_entrega_items} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>Ayudas entregadas</label>
            {loadingTipos ? (
              <p className="text-xs text-gray-400 py-2">Cargando catálogo…</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tipos.map((tipo) => {
                  const activa = tipo.id in cantidades;
                  const editando = editingTipoId === tipo.id;
                  return (
                    <div
                      key={tipo.id}
                      className={[
                        "rounded-lg border-2 p-3 transition-colors select-none",
                        activa ? "border-primary bg-primary/5" : "border-border bg-white hover:border-gray-300",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        {editando ? (
                          <input
                            autoFocus
                            value={editTipoNombre}
                            onChange={(e) => setEditTipoNombre(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); guardarEdicionTipo(tipo.id); } if (e.key === "Escape") setEditingTipoId(null); }}
                            onBlur={() => guardarEdicionTipo(tipo.id)}
                            className="flex-1 text-sm bg-white border border-primary rounded-md px-2 py-1 text-gray-900 focus:outline-none"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleAyuda(tipo.id)}
                            className={`flex-1 text-left text-sm font-semibold ${activa ? "text-primary" : "text-gray-700"}`}
                          >
                            {tipo.nombre}
                          </button>
                        )}
                        {!editando && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setEditingTipoId(tipo.id); setEditTipoNombre(tipo.nombre); }}
                            className="shrink-0 text-[11px] text-gray-400 hover:text-gray-700"
                            aria-label={`Editar ${tipo.nombre}`}
                          >
                            editar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleAyuda(tipo.id)}
                          className={[
                            "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-colors",
                            activa ? "border-primary bg-primary text-white" : "border-gray-300 text-transparent",
                          ].join(" ")}
                          aria-label={activa ? `Quitar ${tipo.nombre}` : `Agregar ${tipo.nombre}`}
                        >
                          ✓
                        </button>
                      </div>
                      {activa && (
                        <div className="mt-2 flex items-center gap-2">
                          <label className="text-[11px] text-gray-500">Cantidad</label>
                          <input
                            type="number"
                            min={1}
                            value={cantidades[tipo.id] ?? ""}
                            onChange={(e) => setCantidad(tipo.id, e.target.value)}
                            className="w-20 text-sm bg-white border border-border rounded-md px-2 py-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Otro: crea un tipo de ayuda nuevo en el catálogo */}
                {addingTipo ? (
                  <div className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-3 flex items-center gap-2">
                    <input
                      autoFocus
                      value={nuevoTipoNombre}
                      onChange={(e) => setNuevoTipoNombre(e.target.value)}
                      placeholder="Nombre de la ayuda (ej: Cobijas)"
                      className="flex-1 text-sm bg-white border border-border rounded-md px-2 py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); crearTipo(); } if (e.key === "Escape") setAddingTipo(false); }}
                    />
                    <button
                      type="button"
                      onClick={crearTipo}
                      disabled={savingTipo || !nuevoTipoNombre.trim()}
                      className="text-xs font-bold text-white bg-primary hover:bg-primary-dark rounded-md px-3 py-1.5 disabled:opacity-60 whitespace-nowrap"
                    >
                      {savingTipo ? "…" : "Crear"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAddingTipo(false); setNuevoTipoNombre(""); }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingTipo(true)}
                    className="rounded-lg border-2 border-dashed border-border hover:border-primary/40 p-3 text-sm font-semibold text-gray-400 hover:text-primary transition-colors text-center"
                  >
                    + Otro
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !puedeGuardar}
            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg shadow-sm transition-colors text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed active:translate-y-px"
          >
            {submitting ? "Guardando…" : "Guardar"}
          </button>
        </form>
      )}

      {subView === "entregadas" && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              Ayudas entregadas
            </h3>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <input
                value={searchNombre}
                onChange={(e) => setSearchNombre(e.target.value)}
                placeholder="Buscar por nombre…"
                className="text-sm bg-white border border-border rounded-lg px-3 py-1.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary flex-1 sm:w-44"
              />
              <input
                inputMode="numeric"
                value={searchCedula}
                onChange={(e) => setSearchCedula(onlyDigits(e.target.value))}
                placeholder="Buscar por cédula…"
                className="text-sm bg-white border border-border rounded-lg px-3 py-1.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary flex-1 sm:w-44"
              />
              <select
                value={filterTipoId}
                onChange={(e) => setFilterTipoId(e.target.value)}
                className="text-sm bg-white border border-border rounded-lg px-3 py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary flex-1 sm:w-44"
              >
                <option value="">Todas las ayudas</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {loadingRows ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-11 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">
              {searchCedula || searchNombre || filterTipoId ? "Sin registros para esos filtros." : "Aún no hay ayudas registradas."}
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-border">
                    <th className="py-2 px-2 font-semibold">Cédula</th>
                    <th className="py-2 px-2 font-semibold">Nombre</th>
                    <th className="py-2 px-2 font-semibold">Ayudas</th>
                    <th className="py-2 px-2 font-semibold text-right">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 hover:bg-muted/50">
                      <td className="py-2 px-2 font-mono text-xs text-gray-600">{r.cedula}</td>
                      <td className="py-2 px-2 font-medium text-gray-800">{r.nombre_completo}</td>
                      <td className="py-2 px-2"><AyudasBadges items={r.ayuda_entrega_items} /></td>
                      <td className="py-2 px-2 text-right text-xs text-gray-500 whitespace-nowrap">
                        {fmtFecha(r.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
