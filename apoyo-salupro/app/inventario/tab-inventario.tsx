"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast-provider";
import type { ItemRow, MovementRow, SectionWithSubcats } from "./types";
import type { InventoryLocation } from "@/lib/types/database";
import { Combobox } from "@/components/ui/combobox";
import { inputCls, inputDisabledCls, labelCls } from "./cascade-step";

const textareaCls = inputCls + " resize-none";

type SubView = "tablero" | "entrada" | "salida" | "kardex";

export function TabInventario() {
  const toast = useToast();
  const [subView, setSubView] = useState<SubView>("tablero");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [sections, setSections] = useState<SectionWithSubcats[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingSections, setLoadingSections] = useState(true);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const res = await fetch("/api/inventory/items", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setItems(json.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los artículos");
    } finally {
      setLoadingItems(false);
    }
  }, [toast]);

  const loadSections = useCallback(async () => {
    setLoadingSections(true);
    try {
      const res = await fetch("/api/inventory/sections", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSections(json.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar las categorías");
    } finally {
      setLoadingSections(false);
    }
  }, [toast]);

  const loadLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/inventory/locations", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setLocations(json.data ?? []);
    } catch {
      // Silencioso: las ubicaciones son opcionales
    }
  }, []);

  useEffect(() => {
    loadItems();
    loadSections();
    loadLocations();
  }, [loadItems, loadSections, loadLocations]);

  const createSection = useCallback(async (name: string): Promise<string | null> => {
    const code = prompt("Código de la categoría (ej: MED, ALIM, LIMP):");
    if (!code) return null;
    const res = await fetch("/api/inventory/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim().toUpperCase(), name }),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      toast.error(json.error || "No se pudo crear la categoría");
      return null;
    }
    toast.success(`Categoría "${json.data.name}" creada`);
    await loadSections();
    return json.data.id;
  }, [loadSections, toast]);

  const createSubcategory = useCallback(async (sectionId: string, name: string): Promise<string | null> => {
    const code = prompt("Código de la subcategoría (ej: ANALG, INHAL, JABON):");
    if (!code) return null;
    const res = await fetch("/api/inventory/subcategories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section_id: sectionId, code: code.trim().toUpperCase(), name }),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      toast.error(json.error || "No se pudo crear la subcategoría");
      return null;
    }
    toast.success(`Subcategoría "${json.data.name}" creada`);
    await loadSections();
    return json.data.id;
  }, [loadSections, toast]);

  const createLocation = useCallback(async (name: string): Promise<string | null> => {
    const res = await fetch("/api/inventory/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      toast.error(json.error || "No se pudo crear la ubicación");
      return null;
    }
    toast.success(`Ubicación "${json.data.name}" creada`);
    await loadLocations();
    return json.data.id;
  }, [loadLocations, toast]);

  const subViewOpts: { v: SubView; label: string }[] = [
    { v: "tablero", label: "Tablero" },
    { v: "entrada", label: "Entrada" },
    { v: "salida", label: "Salida" },
    { v: "kardex", label: "Kardex" },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-6">
      <div className="border-b border-border pb-3 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Inventario</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Stock por artículo · Entradas y salidas · Kardex
          </p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {subViewOpts.map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setSubView(opt.v)}
              className={`text-sm font-semibold px-3.5 py-1.5 rounded-md transition-colors ${
                subView === opt.v ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {subView === "tablero" && (
        <Tablero items={items} loading={loadingItems} />
      )}
      {subView === "entrada" && (
        <MovimientoForm
          tipo="entrada"
          items={items}
          sections={sections}
          locations={locations}
          loading={loadingItems || loadingSections}
          onCreated={loadItems}
          onCreateSection={createSection}
          onCreateSubcategory={createSubcategory}
          onCreateLocation={createLocation}
        />
      )}
      {subView === "salida" && (
        <MovimientoForm
          tipo="salida"
          items={items}
          sections={sections}
          locations={locations}
          loading={loadingItems || loadingSections}
          onCreated={loadItems}
          onCreateSection={createSection}
          onCreateSubcategory={createSubcategory}
          onCreateLocation={createLocation}
        />
      )}
      {subView === "kardex" && (
        <Kardex items={items} loadingItems={loadingItems} />
      )}
    </div>
  );
}

/* ─────────────────────────────── Tablero ────────────────────────────────── */

function Tablero({ items, loading }: { items: ItemRow[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Cargando inventario…</p>;
  if (items.length === 0)
    return (
      <p className="text-sm text-gray-400 py-8 text-center">
        No hay artículos registrados. Ve a <strong>Administración → Artículos</strong> para agregar.
      </p>
    );

  // Agrupar por sección
  const bySection = items.reduce<Record<string, { sectionName: string; items: ItemRow[] }>>(
    (acc, it) => {
      const sec = it.subcategory?.section;
      const key = sec?.id ?? "__sin_seccion__";
      const name = sec ? `${sec.id ? sec.name : "Sin sección"}` : "Sin sección";
      if (!acc[key]) acc[key] = { sectionName: name, items: [] };
      acc[key].items.push(it);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      {Object.entries(bySection).map(([key, { sectionName, items: secItems }]) => (
        <div key={key}>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">
            {sectionName}
          </h3>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-border">
                  <th className="py-2 px-2 font-semibold">Subcategoría</th>
                  <th className="py-2 px-2 font-semibold">Presentación</th>
                  <th className="py-2 px-2 font-semibold">Ubicación</th>
                  <th className="py-2 px-2 font-semibold text-right">Stock</th>
                </tr>
              </thead>
              <tbody>
                {secItems.map((it) => (
                  <tr key={it.id} className={`border-b border-border/60 hover:bg-muted/50 ${it.stock === 0 ? "opacity-50" : ""}`}>
                    <td className="py-2 px-2 text-gray-600 text-xs">{it.subcategory?.name ?? "—"}</td>
                    <td className="py-2 px-2">
                      <div className="font-medium text-gray-800">{it.presentacion}</div>
                    </td>
                    <td className="py-2 px-2 text-gray-500 text-xs">{it.location?.name ?? "—"}</td>
                    <td className="py-2 px-2 text-right">
                      <span className={`font-bold tabular-nums text-sm ${it.stock === 0 ? "text-crisis" : it.stock < 5 ? "text-amber-600" : "text-gray-800"}`}>
                        {it.stock}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── Formulario de movimiento ───────────────────── */

function MovimientoForm({
  tipo,
  items,
  sections,
  locations,
  loading,
  onCreated,
  onCreateSection,
  onCreateSubcategory,
  onCreateLocation,
}: {
  tipo: "entrada" | "salida";
  items: ItemRow[];
  sections: SectionWithSubcats[];
  locations: InventoryLocation[];
  loading: boolean;
  onCreated: () => void;
  onCreateSection: (name: string) => Promise<string | null>;
  onCreateSubcategory: (sectionId: string, name: string) => Promise<string | null>;
  onCreateLocation: (name: string) => Promise<string | null>;
}) {
  const toast = useToast();
  const [sectionId, setSectionId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [itemId, setItemId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [entregadoPor, setEntregadoPor] = useState("");
  const [destinatario, setDestinatario] = useState("");
  const [medioTransporte, setMedioTransporte] = useState("");
  const [nota, setNota] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickNombre, setQuickNombre] = useState("");
  const [quickCantidad, setQuickCantidad] = useState("");
  const [quickCreating, setQuickCreating] = useState(false);
  const cantidadRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => items.find((it) => it.id === itemId) ?? null, [items, itemId]);

  const selectedSection = useMemo(
    () => sections.find((s) => s.id === sectionId) ?? null,
    [sections, sectionId],
  );

  const filteredItems = useMemo(() => {
    if (!subcategoryId) return [] as ItemRow[];
    return items.filter((it) => it.subcategory?.id === subcategoryId);
  }, [items, subcategoryId]);

  const sectionItems = useMemo(
    () => sections.map((s) => ({ id: s.id, label: `${s.code}. ${s.name}` })),
    [sections],
  );

  const subcategoryItems = useMemo(
    () => (selectedSection?.subcategories ?? []).map((sc) => ({ id: sc.id, label: sc.name })),
    [selectedSection],
  );

  const locationItems = useMemo(
    () => locations.map((l) => ({ id: l.id, label: l.name })),
    [locations],
  );

  const quickCreate = async () => {
    const nombre = quickNombre.trim();
    if (!nombre) return toast.error("El nombre del artículo es obligatorio.");
    const cant = Number(quickCantidad);
    if (!Number.isFinite(cant) || cant <= 0) return toast.error("Cantidad inicial debe ser mayor a 0.");

    setQuickCreating(true);
    try {
      const res = await fetch("/api/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subcategory_id: subcategoryId,
          presentacion: nombre,
          location_id: locationId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        if (res.status === 409) throw new Error("Ya existe un artículo con ese nombre en esta subcategoría.");
        throw new Error(json.error || "No se pudo crear el artículo");
      }

      const newItemId = json.data.id;
      const mvRes = await fetch("/api/inventory/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: newItemId,
          tipo: "entrada",
          cantidad: cant,
          nota: "Carga inicial rápida",
        }),
      });
      const mvJson = await mvRes.json();
      if (!mvRes.ok || mvJson.error) throw new Error(mvJson.error || "Artículo creado pero no se pudo registrar la carga.");

      toast.success(`Artículo "${nombre}" creado con ${cant} unidades`);
      await onCreated();
      setItemId(newItemId);
      setShowQuickCreate(false);
      setQuickNombre("");
      setQuickCantidad("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setQuickCreating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId) return toast.error("Seleccione un artículo.");
    const cant = Number(cantidad);
    if (!Number.isFinite(cant) || cant <= 0) return toast.error("Cantidad inválida.");
    if (tipo === "salida" && cant > (selected?.stock ?? 0))
      return toast.error(`Stock insuficiente: solo hay ${selected?.stock ?? 0} disponibles.`);

    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: itemId,
          tipo,
          cantidad: cant,
          location_id: locationId || null,
          entregado_por: tipo === "entrada" ? entregadoPor.trim() || null : null,
          destinatario: tipo === "salida" ? destinatario.trim() || null : null,
          medio_transporte: tipo === "salida" ? medioTransporte.trim() || null : null,
          nota: nota.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Error al registrar");

      const count = sessionCount + 1;
      setSessionCount(count);
      const secName = selected?.subcategory?.section?.name ?? "";
      const subName = selected?.subcategory?.name ?? "";
      const label = selected
        ? `"${selected.presentacion}" (${[secName, subName].filter(Boolean).join(" › ")})`
        : "artículo";
      toast.success(
        tipo === "entrada"
          ? `Entrada de ${cant} × ${label} registrada · ${count} en sesión`
          : `Salida de ${cant} × ${label} registrada · ${count} en sesión`,
      );

      setCantidad("");
      setNota("");
      if (tipo === "entrada") setEntregadoPor("");
      if (tipo === "salida") { setDestinatario(""); setMedioTransporte(""); }
      onCreated();
      cantidadRef.current?.focus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <p className="text-xs text-gray-500 bg-muted border border-border rounded-lg px-3 py-2">
        {tipo === "entrada"
          ? "💡 Registra materiales que ingresan al centro de acopio."
          : "💡 Registra materiales que salen del centro hacia un destinatario."}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Categoría</label>
          <Combobox
            items={sectionItems}
            value={sectionId}
            onChange={(id) => {
              setSectionId(id);
              setSubcategoryId("");
              setItemId("");
              setShowQuickCreate(false);
            }}
            placeholder="Seleccione..."
            disabled={loading}
            createLabel="Crear nueva categoría"
            createPlaceholder="Nombre de la categoría"
            onCreate={onCreateSection}
          />
        </div>

        <div>
          <label className={labelCls}>Subcategoría</label>
          <Combobox
            items={subcategoryItems}
            value={subcategoryId}
            onChange={(id) => {
              setSubcategoryId(id);
              setItemId("");
              setShowQuickCreate(false);
            }}
            placeholder="Seleccione..."
            disabled={!sectionId}
            emptyText="Selecciona primero la categoría"
            createLabel="Crear nueva subcategoría"
            createPlaceholder="Nombre de la subcategoría"
            onCreate={sectionId ? (name) => onCreateSubcategory(sectionId, name) : undefined}
          />
        </div>

        <div>
          <label className={labelCls}>Artículo</label>
          <select
            value={itemId}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "__quick_create__") {
                setShowQuickCreate(true);
                setItemId("");
                setTimeout(() => document.getElementById("quick-nombre")?.focus(), 50);
                return;
              }
              setItemId(val);
              setShowQuickCreate(false);
              const found = items.find((it) => it.id === val);
              if (found) setLocationId(found.location_id ?? "");
            }}
            className={!subcategoryId ? inputDisabledCls : inputCls}
            disabled={!subcategoryId}
          >
            <option value="">— Seleccione —</option>
            {filteredItems.map((it) => {
              const d = tipo === "salida" && it.stock === 0;
              const loc = it.location?.name ? ` 📍${it.location.name}` : "";
              return (
                <option key={it.id} value={it.id} disabled={d}>
                  {it.presentacion}
                  {tipo === "salida" ? ` (${it.stock} disp.)` : ` (${it.stock})`}{loc}
                </option>
              );
            })}
            {subcategoryId && (
              <option value="__quick_create__" className="text-primary font-semibold">
                + Nuevo artículo
              </option>
            )}
          </select>
        </div>
      </div>

      {subcategoryId && !itemId && filteredItems.length === 0 && !showQuickCreate && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-center gap-2">
          <span className="text-base">📦</span>
          <span>No hay artículos en esta subcategoría. Selección <strong>+ Nuevo artículo</strong> en el select de arriba para crear uno.</span>
        </div>
      )}

      {showQuickCreate && subcategoryId && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-3 animate-in fade-in">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">Nombre del artículo</label>
              <input
                id="quick-nombre"
                value={quickNombre}
                onChange={(e) => setQuickNombre(e.target.value)}
                placeholder="Ej: Jarabe 120ml, Caja × 12..."
                className={inputCls}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); quickCreate(); } }}
              />
            </div>
            <div className="w-28">
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">Cant. inicial</label>
              <input
                type="number"
                min={1}
                value={quickCantidad}
                onChange={(e) => setQuickCantidad(e.target.value)}
                placeholder="1"
                className={inputCls}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); quickCreate(); } }}
              />
            </div>
            <button
              type="button"
              onClick={quickCreate}
              disabled={quickCreating}
              className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-4 py-2.5 rounded-lg disabled:opacity-60 whitespace-nowrap"
            >
              {quickCreating ? "Creando…" : "Crear"}
            </button>
            <button
              type="button"
              onClick={() => { setShowQuickCreate(false); setQuickNombre(""); setQuickCantidad(""); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancelar
            </button>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">Ubicación (opcional)</label>
            <Combobox
              items={locationItems}
              value={locationId}
              onChange={setLocationId}
              placeholder="Seleccione ubicación..."
              emptyText="Sin ubicaciones"
              createLabel="Crear nueva ubicación"
              createPlaceholder="Nombre de la ubicación"
              onCreate={onCreateLocation}
            />
          </div>
        </div>
      )}

      {selected && (
        <p className="text-[11px] text-gray-400 mt-1">
          📍 {selected.location?.name ?? "Sin ubicación asignada"}
          {tipo === "salida" && <span className="ml-3 font-semibold text-gray-600">Stock: {selected.stock}</span>}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Ubicación (opcional)</label>
          <Combobox
            items={locationItems}
            value={locationId}
            onChange={setLocationId}
            placeholder="Seleccione ubicación..."
            emptyText="Sin ubicaciones"
            createLabel="Crear nueva ubicación"
            createPlaceholder="Nombre de la ubicación"
            onCreate={onCreateLocation}
          />
        </div>
        <div>
          <label className={labelCls}>
            Cantidad
            {tipo === "salida" && selected && (
              <span className="ml-2 font-normal text-gray-400">máx: {selected.stock}</span>
            )}
          </label>
          <input
            ref={cantidadRef}
            type="number"
            min={1}
            max={tipo === "salida" && selected ? selected.stock : undefined}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder="0"
            className={inputCls}
          />
        </div>
      </div>

      {tipo === "entrada" && (
        <div>
          <label className={labelCls}>Quién entrega (opcional)</label>
          <input
            value={entregadoPor}
            onChange={(e) => setEntregadoPor(e.target.value)}
            placeholder="Nombre de la persona u organización que entrega"
            className={inputCls}
          />
        </div>
      )}
      {tipo === "salida" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Destinatario</label>
            <input
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder="A quién se envía"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Medio de transporte (opcional)</label>
            <input
              value={medioTransporte}
              onChange={(e) => setMedioTransporte(e.target.value)}
              placeholder="Ej: camión, moto, a pie…"
              className={inputCls}
            />
          </div>
        </div>
      )}

      <div>
        <label className={labelCls}>Nota (opcional)</label>
        <textarea
          rows={2}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Observaciones adicionales…"
          className={textareaCls}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className={`flex-1 font-bold py-3 rounded-lg shadow-sm transition-colors text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed text-white ${
            tipo === "entrada"
              ? "bg-primary hover:bg-primary/90"
              : "bg-gray-800 hover:bg-gray-900"
          }`}
        >
          {submitting
            ? "REGISTRANDO…"
            : tipo === "entrada"
            ? "REGISTRAR ENTRADA"
            : "REGISTRAR SALIDA"}
        </button>
        {sessionCount > 0 && (
          <span className="text-xs font-semibold text-primary whitespace-nowrap">
            {sessionCount} en sesión
          </span>
        )}
      </div>
    </form>
  );
}

/* ──────────────────────────────── Kardex ────────────────────────────────── */

function Kardex({ items, loadingItems }: { items: ItemRow[]; loadingItems: boolean }) {
  const toast = useToast();
  const [itemId, setItemId] = useState("");
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itemId) { setMovements([]); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/inventory/movements?item_id=${itemId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) toast.error(json.error);
        else setMovements(json.data ?? []);
      })
      .catch(() => toast.error("No se pudo cargar el kardex"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [itemId, toast]);

  const selected = useMemo(() => items.find((it) => it.id === itemId) ?? null, [items, itemId]);

  return (
    <div className="space-y-5">
      <div className="max-w-md">
        <label className={labelCls}>Artículo</label>
        <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={inputCls} disabled={loadingItems}>
          <option value="">— Seleccione un artículo —</option>
          {items.map((it) => {
            const sec = it.subcategory?.section?.name ?? "";
            const sub = it.subcategory?.name ?? "";
            const path = [sec, sub].filter(Boolean).join(" › ");
            return (
              <option key={it.id} value={it.id}>
                {path ? `${path} · ` : ""}{it.presentacion}
              </option>
            );
          })}
        </select>
      </div>

      {selected && (
        <div className="flex items-center gap-4 bg-muted border border-border rounded-lg px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400">Artículo</p>
            <p className="font-semibold text-gray-800 truncate">{selected.presentacion}</p>
            <p className="text-[11px] text-gray-400 truncate">
              {[selected.subcategory?.section?.name, selected.subcategory?.name].filter(Boolean).join(" › ")}
              {selected.location?.name ? ` · 📍 ${selected.location.name}` : selected.subcategory?.code ? ` · 📍 ${selected.subcategory.code}` : ""}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] text-gray-400">Stock actual</p>
            <p className={`text-2xl font-bold tabular-nums ${selected.stock === 0 ? "text-crisis" : selected.stock < 5 ? "text-amber-600" : "text-primary"}`}>
              {selected.stock}
            </p>
          </div>
        </div>
      )}

      {!itemId && (
        <p className="text-sm text-gray-400 py-8 text-center">Seleccione un artículo para ver su historial.</p>
      )}
      {itemId && loading && (
        <p className="text-sm text-gray-400 py-8 text-center">Cargando kardex…</p>
      )}
      {itemId && !loading && movements.length === 0 && (
        <p className="text-sm text-gray-400 py-8 text-center">Este artículo no tiene movimientos aún.</p>
      )}
      {itemId && !loading && movements.length > 0 && (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-border">
                <th className="py-2 px-2 font-semibold">Fecha</th>
                <th className="py-2 px-2 font-semibold">Tipo</th>
                <th className="py-2 px-2 font-semibold text-right">Cant.</th>
                <th className="py-2 px-2 font-semibold text-right">Stock ant.</th>
                <th className="py-2 px-2 font-semibold text-right">Stock nuevo</th>
                <th className="py-2 px-2 font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((mv) => {
                const detalle =
                  mv.tipo === "entrada"
                    ? mv.entregado_por ?? mv.nota ?? "—"
                    : [mv.destinatario, mv.medio_transporte, mv.nota].filter(Boolean).join(" · ") || "—";
                return (
                  <tr key={mv.id} className="border-b border-border/60 hover:bg-muted/50">
                    <td className="py-2 px-2 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(mv.created_at).toLocaleDateString("es-VE")}
                      <span className="ml-1 text-gray-400">
                        {new Date(mv.created_at).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        mv.tipo === "entrada"
                          ? "bg-primary/10 text-primary"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {mv.tipo === "entrada" ? "↓ Entrada" : "↑ Salida"}
                      </span>
                    </td>
                    <td className={`py-2 px-2 text-right font-bold tabular-nums ${mv.tipo === "entrada" ? "text-primary" : "text-amber-700"}`}>
                      {mv.tipo === "entrada" ? "+" : "-"}{mv.cantidad}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-500">{mv.previous_stock}</td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold text-gray-800">{mv.new_stock}</td>
                    <td className="py-2 px-2 text-xs text-gray-500 max-w-[200px] truncate" title={detalle}>
                      {detalle}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
