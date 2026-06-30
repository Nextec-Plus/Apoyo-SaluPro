"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast-provider";
import type { ItemRow, SectionWithSubcats } from "./types";
import type { InventoryLocation } from "@/lib/types/database";

const inputCls =
  "w-full text-sm bg-white border border-border rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-colors";
const labelCls = "block text-xs font-semibold text-gray-700 mb-1";

type SubView = "articulos" | "ubicaciones";

export function TabAdmin() {
  const toast = useToast();
  const [subView, setSubView] = useState<SubView>("articulos");
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
            Artículos del centro · Ubicaciones físicas
          </p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {([
            { v: "articulos", label: `Artículos${items.length ? ` (${items.length})` : ""}` },
            { v: "ubicaciones", label: `Ubicaciones${locations.length ? ` (${locations.length})` : ""}` },
          ] as const).map((opt) => (
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

      {subView === "articulos" && (
        <ArticulosPanel
          sections={sections}
          items={items}
          locations={locations}
          loading={loading}
          onChanged={async () => { await Promise.all([loadItems()]); }}
        />
      )}
      {subView === "ubicaciones" && (
        <UbicacionesPanel
          locations={locations}
          loading={loading}
          onChanged={loadLocations}
        />
      )}
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
  const [locationId, setLocationId] = useState("");
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

    setCreating(true);
    try {
      const res = await fetch("/api/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subcategory_id: subcategoryId,
          presentacion: pres,
          location_id: locationId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        if (res.status === 409) throw new Error("Ya existe un artículo con esa presentación en esta subcategoría.");
        throw new Error(json.error || "No se pudo crear el artículo");
      }
      toast.success(`Artículo "${pres}" registrado`);
      setPresentacion("");
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
          Cada artículo = subcategoría + presentación específica (ej: "Pediátricos · Jarabe 120ml").
          El stock inicial es 0; se incrementa con entradas.
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
            <label className={labelCls}>Ubicación (opcional)</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputCls}>
              <option value="">— Sin asignar —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
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

/* ─────────────────────────────── Ubicaciones ────────────────────────────── */

function UbicacionesPanel({
  locations,
  loading,
  onChanged,
}: {
  locations: InventoryLocation[];
  loading: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return toast.error("El nombre es obligatorio.");
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, description: description.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        if (res.status === 409) throw new Error("Ya existe una ubicación con ese nombre.");
        throw new Error(json.error || "No se pudo crear");
      }
      toast.success(`Ubicación "${trimmed}" creada`);
      setName("");
      setDescription("");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="bg-muted border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          Nueva ubicación
        </h3>
        <p className="text-xs text-gray-500">
          Zonas físicas del almacén (ej: Estante A, Sección Refrigerada, Patio).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className={labelCls}>Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Estante A"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Descripción (opcional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Primer nivel, pasillo norte"
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-gray-800 hover:bg-gray-900 text-white font-bold text-sm px-4 py-2.5 rounded-lg disabled:opacity-60"
          >
            {saving ? "…" : "Agregar"}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-gray-400 py-4 text-center">Cargando ubicaciones…</p>
      ) : locations.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No hay ubicaciones registradas.</p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-lg">
          {locations.map((l) => (
            <li key={l.id} className="px-4 py-3">
              <p className="font-medium text-gray-800">{l.name}</p>
              {l.description && <p className="text-[11px] text-gray-400">{l.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
