"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast-provider";
import type { ItemRow, SectionWithSubcats } from "./types";
import type { InventoryLocation } from "@/lib/types/database";

const inputCls =
  "w-full text-sm bg-white border border-border rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-colors";
const labelCls = "block text-xs font-semibold text-gray-700 mb-1";

export function TabAdmin() {
  const toast = useToast();
  const [sections, setSections] = useState<SectionWithSubcats[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSections = useCallback(async () => {
    const res = await fetch("/api/inventory/sections", { cache: "no-store" });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    setSections(json.data ?? []);
  }, []);

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/inventory/items", { cache: "no-store" });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    setItems(json.data ?? []);
  }, []);

  const loadLocations = useCallback(async () => {
    const res = await fetch("/api/inventory/locations", { cache: "no-store" });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    setLocations(json.data ?? []);
  }, []);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadSections(), loadItems(), loadLocations()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [loadSections, loadItems, loadLocations, toast]);

  useEffect(() => { reloadAll(); }, [reloadAll]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-6">
      <div className="border-b border-border pb-3 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Administración</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Artículos del centro de acopio
          </p>
        </div>
      </div>

      <ArticulosPanel
        sections={sections}
        items={items}
        locations={locations}
        loading={loading}
        onChanged={async () => { await Promise.all([loadItems()]); }}
      />
    </div>
  );
}

/* ─────────────────────────────── Artículos ──────────────────────────────── */

function ArticulosPanel({
  sections,
  items,
  locations,
  loading,
  onChanged,
}: {
  sections: SectionWithSubcats[];
  items: ItemRow[];
  locations: InventoryLocation[];
  loading: boolean;
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [sectionId, setSectionId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [presentacion, setPresentacion] = useState("");
  const [stockInicial, setStockInicial] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const selectedSection = useMemo(
    () => sections.find((s) => s.id === sectionId) ?? null,
    [sections, sectionId],
  );

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subcategoryId) return toast.error("Seleccione una subcategoría.");
    const pres = presentacion.trim();
    if (!pres) return toast.error("La presentación es obligatoria.");
    const stock0 = stockInicial === "" ? 0 : Number(stockInicial);
    if (!Number.isFinite(stock0) || stock0 < 0 || !Number.isInteger(stock0))
      return toast.error("Stock inicial debe ser un número entero ≥ 0.");

    setCreating(true);
    try {
      const res = await fetch("/api/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subcategory_id: subcategoryId,
          presentacion: pres,
          location_id: null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        if (res.status === 409) throw new Error("Ya existe un artículo con esa presentación en esta subcategoría.");
        throw new Error(json.error || "No se pudo crear el artículo");
      }

      // Carga inicial: registrar movimiento de entrada si stock0 > 0
      if (stock0 > 0) {
        const mvRes = await fetch("/api/inventory/movements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_id: json.data.id,
            tipo: "entrada",
            cantidad: stock0,
            nota: "Carga inicial",
          }),
        });
        const mvJson = await mvRes.json();
        if (!mvRes.ok || mvJson.error) throw new Error(mvJson.error || "Artículo creado pero no se pudo registrar la carga inicial.");
        toast.success(`Artículo "${pres}" registrado con carga inicial de ${stock0} unidades`);
      } else {
        toast.success(`Artículo "${pres}" registrado (stock 0)`);
      }

      setPresentacion("");
      setStockInicial("");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setCreating(false);
    }
  };

  const deleteItem = async (it: ItemRow) => {
    if (!confirm(`¿Eliminar "${it.presentacion}"? Solo es posible si no tiene movimientos.`)) return;
    try {
      const res = await fetch(`/api/inventory/items/${it.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "No se pudo eliminar");
      toast.success(`"${it.presentacion}" eliminado`);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    }
  };

  return (
    <div className="space-y-6">
      {/* Formulario de alta */}
      <form onSubmit={create} className="bg-muted border border-border rounded-lg p-4 space-y-4">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          Registrar artículo
        </h3>
        <p className="text-xs text-gray-500">
          Cada artículo = subcategoría + presentación específica (ej: {'\u201C'}Pediátricos · Jarabe 120ml{'\u201D'}).
          Si indicas un stock inicial, se registra automáticamente como carga inicial en el kardex.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Sección</label>
            <select
              value={sectionId}
              onChange={(e) => { setSectionId(e.target.value); setSubcategoryId(""); }}
              className={inputCls}
            >
              <option value="">— Seleccione —</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.code}. {s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Subcategoría</label>
            <select
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              className={inputCls}
              disabled={!selectedSection}
            >
              <option value="">— Seleccione —</option>
              {(selectedSection?.subcategories ?? []).map((sc) => (
                <option key={sc.id} value={sc.id}>{sc.code} {sc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Presentación</label>
            <input
              value={presentacion}
              onChange={(e) => setPresentacion(e.target.value)}
              placeholder="Ej: Jarabe 120ml, Caja × 12 tabletas…"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              Stock inicial{" "}
              <span className="font-normal text-gray-400">(unidades — opcional, 0 por defecto)</span>
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={stockInicial}
              onChange={(e) => setStockInicial(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
            {stockInicial !== "" && Number(stockInicial) > 0 && (
              <p className="text-[11px] text-primary mt-1">
                ✓ Se registrará una entrada de <strong>{stockInicial}</strong> unidades como {'\u201C'}Carga inicial{'\u201D'} en el kardex.
              </p>
            )}
          </div>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="bg-gray-800 hover:bg-gray-900 text-white font-bold text-sm px-4 py-2.5 rounded-lg disabled:opacity-60"
        >
          {creating ? "Registrando…" : "Registrar artículo"}
        </button>
      </form>

      {/* Lista de artículos */}
      {loading ? (
        <p className="text-sm text-gray-400 py-4 text-center">Cargando artículos…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No hay artículos registrados aún.</p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-border">
                <th className="py-2 px-2 font-semibold">Subcategoría</th>
                <th className="py-2 px-2 font-semibold">Presentación</th>
                <th className="py-2 px-2 font-semibold">Ubicación</th>
                <th className="py-2 px-2 font-semibold text-right">Stock</th>
                <th className="py-2 px-2 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-border/60 hover:bg-muted/50">
                  <td className="py-2 px-2 text-xs text-gray-500">
                    <span className="text-gray-400">{it.subcategory?.section?.name ?? ""} › </span>
                    {it.subcategory?.name ?? "—"}
                  </td>
                  <td className="py-2 px-2 font-medium text-gray-800">
                    {editingId === it.id ? (
                      <EditLocationInline
                        item={it}
                        locations={locations}
                        onSaved={async () => { setEditingId(null); await onChanged(); }}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      it.presentacion
                    )}
                  </td>
                  <td className="py-2 px-2 text-xs text-gray-500">{it.location?.name ?? "—"}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-semibold text-gray-800">{it.stock}</td>
                  <td className="py-2 px-2 text-right whitespace-nowrap">
                    {editingId !== it.id && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingId(it.id)}
                          className="text-xs font-semibold text-primary hover:underline mr-3"
                        >
                          Ubicación
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteItem(it)}
                          className="text-xs font-semibold text-crisis hover:underline"
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EditLocationInline({
  item,
  locations,
  onSaved,
  onCancel,
}: {
  item: ItemRow;
  locations: InventoryLocation[];
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [locationId, setLocationId] = useState(item.location_id ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/inventory/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location_id: locationId || null }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "No se pudo actualizar");
      toast.success("Ubicación actualizada");
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-800">{item.presentacion}</span>
      <select
        value={locationId}
        onChange={(e) => setLocationId(e.target.value)}
        className="text-xs bg-white border border-border rounded px-2 py-1 focus:outline-none"
      >
        <option value="">Sin ubicación</option>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      <button type="button" onClick={save} disabled={saving}
        className="text-xs font-bold text-primary hover:underline disabled:opacity-60">
        {saving ? "…" : "OK"}
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-700">✕</button>
    </div>
  );
}

