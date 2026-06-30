"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast-provider";
import type { CategoryWithLocation, MaterialRow } from "./types";

const inputCls =
  "w-full text-sm bg-white border border-border rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-colors";
const textareaCls = inputCls + " resize-none";
const labelCls = "block text-xs font-semibold text-gray-700 mb-1";

type SubView = "cargar" | "inventario" | "categorias";

/** Resuelve la ruta "Categoría › Subcategoría" y su localización de un material. */
function resolveCategory(
  categoryId: string | null,
  byId: Map<string, CategoryWithLocation>,
) {
  if (!categoryId) return { label: "—", location: "—" };
  const cat = byId.get(categoryId);
  if (!cat) return { label: "—", location: "—" };
  if (cat.parent_id) {
    const parent = byId.get(cat.parent_id);
    return {
      label: `${parent?.name ?? "?"} › ${cat.name}`,
      location: parent?.location?.name ?? cat.location?.name ?? "—",
    };
  }
  return { label: cat.name, location: cat.location?.name ?? "—" };
}

export function TabMateriales() {
  const toast = useToast();
  const [subView, setSubView] = useState<SubView>("cargar");
  const [categories, setCategories] = useState<CategoryWithLocation[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingMats, setLoadingMats] = useState(true);

  const byId = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const tops = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories],
  );

  const loadCategories = useCallback(async () => {
    setLoadingCats(true);
    try {
      const res = await fetch("/api/inventory/categories", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setCategories(json.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar las categorías");
    } finally {
      setLoadingCats(false);
    }
  }, [toast]);

  const loadMaterials = useCallback(async () => {
    setLoadingMats(true);
    try {
      const res = await fetch("/api/inventory/materials", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMaterials(json.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los materiales");
    } finally {
      setLoadingMats(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCategories();
    loadMaterials();
  }, [loadCategories, loadMaterials]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-6">
      <div className="border-b border-border pb-3 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Materiales</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Catálogo de insumos por categoría y localización.
          </p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(
            [
              { v: "cargar", label: "Cargar material" },
              { v: "inventario", label: `Inventario${materials.length ? ` (${materials.length})` : ""}` },
              { v: "categorias", label: "Categorías" },
            ] as const
          ).map((opt) => (
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

      {subView === "cargar" && (
        <CargarMaterial
          tops={tops}
          byId={byId}
          loadingCats={loadingCats}
          onCreated={loadMaterials}
        />
      )}
      {subView === "inventario" && (
        <InventarioList
          materials={materials}
          byId={byId}
          loading={loadingMats}
          onChanged={loadMaterials}
        />
      )}
      {subView === "categorias" && (
        <CategoriasPanel
          categories={categories}
          tops={tops}
          loading={loadingCats}
          onChanged={loadCategories}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Cargar material (carga consecutiva) ────────────── */

function CargarMaterial({
  tops,
  byId,
  loadingCats,
  onCreated,
}: {
  tops: CategoryWithLocation[];
  byId: Map<string, CategoryWithLocation>;
  loadingCats: boolean;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [topId, setTopId] = useState("");
  const [subId, setSubId] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [stock, setStock] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);

  // Subcategorías del top seleccionado.
  const subs = useMemo(
    () => Array.from(byId.values()).filter((c) => c.parent_id === topId),
    [byId, topId],
  );

  // ── Autocompletado de nombre (sugerencias de materiales ya creados) ────────
  const [suggestions, setSuggestions] = useState<MaterialRow[]>([]);
  const [showSug, setShowSug] = useState(false);

  useEffect(() => {
    const term = name.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/inventory/materials?search=${encodeURIComponent(term)}&limit=8`,
          { cache: "no-store", signal: ctrl.signal },
        );
        const json = await res.json();
        if (!json.error) setSuggestions(json.data ?? []);
      } catch {
        /* abortado o error transitorio: se ignora */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [name]);

  /** Al elegir una sugerencia: autollenar nombre, unidad, descripción y categoría. */
  const pickSuggestion = (m: MaterialRow) => {
    setName(m.name ?? "");
    setUnit(m.unit ?? "");
    if (m.category_id) {
      const cat = byId.get(m.category_id);
      if (cat?.parent_id) {
        setTopId(cat.parent_id);
        setSubId(cat.id);
      } else if (cat) {
        setTopId(cat.id);
        setSubId("");
      }
    }
    setShowSug(false);
    setSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("El nombre del material es obligatorio.");
      return;
    }
    // category_id: la subcategoría si está elegida; si no, la categoría tope.
    const category_id = subId || topId || null;
    const stockNum = stock === "" ? 0 : Number(stock);
    if (!Number.isFinite(stockNum) || stockNum < 0) {
      toast.error("La cantidad (stock) no es válida.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          category_id,
          unit: unit.trim() || null,
          stock: stockNum,
          description: description.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "No se pudo guardar el material");

      const count = sessionCount + 1;
      setSessionCount(count);
      toast.success(`"${trimmed}" cargado · ${count} en esta sesión`);

      // Carga consecutiva: se conserva la categoría/subcategoría y la unidad
      // (suele repetirse en el mismo lote) y se limpia el resto para seguir.
      setName("");
      setStock("");
      setDescription("");
      setSuggestions([]);
      setShowSug(false);
      onCreated();
      nameRef.current?.focus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTop = topId ? byId.get(topId) : null;
  const location = selectedTop?.location?.name ?? "—";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-xs text-gray-500 bg-muted border border-border rounded-lg px-3 py-2">
        💡 Carga consecutiva: al guardar, el formulario queda listo para el siguiente
        material sin salir. La categoría y la unidad se conservan.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Categoría</label>
          <select
            value={topId}
            onChange={(e) => {
              setTopId(e.target.value);
              setSubId("");
            }}
            className={inputCls}
            disabled={loadingCats}
          >
            <option value="">— Seleccione —</option>
            {tops.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code ? `${c.code}. ` : ""}{c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>
            Subcategoría
            {location !== "—" && (
              <span className="ml-2 font-normal text-gray-400">📍 {location}</span>
            )}
          </label>
          <select
            value={subId}
            onChange={(e) => setSubId(e.target.value)}
            className={inputCls}
            disabled={!topId || subs.length === 0}
          >
            <option value="">{subs.length ? "— Seleccione —" : "Sin subcategorías"}</option>
            {subs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code ? `${c.code} ` : ""}{c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Nombre con autocompletado */}
      <div className="relative">
        <label className={labelCls}>Nombre del material</label>
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setShowSug(true);
          }}
          onFocus={() => setShowSug(true)}
          onBlur={() => setTimeout(() => setShowSug(false), 150)}
          placeholder="Ej: Acetaminofén 500mg"
          autoComplete="off"
          className={inputCls}
        />
        {showSug && suggestions.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
            {suggestions.map((m) => {
              const { label } = resolveCategory(m.category_id, byId);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSuggestion(m)}
                    className="w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center justify-between gap-2"
                  >
                    <span className="text-sm text-gray-800">{m.name}</span>
                    <span className="text-[11px] text-gray-400 shrink-0">{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Cantidad (stock)</label>
          <input
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="0"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Unidad</label>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Ej: cajas, tabletas, unidades"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Descripción (opcional)</label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Presentación, concentración, notas…"
          className={textareaCls}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 rounded-lg shadow-sm transition-colors text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "GUARDANDO…" : "GUARDAR Y SEGUIR CARGANDO"}
        </button>
        {sessionCount > 0 && (
          <span className="text-xs font-semibold text-primary whitespace-nowrap">
            {sessionCount} cargado{sessionCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </form>
  );
}

/* ───────────────────────────── Inventario (lista) ─────────────────────────── */

function InventarioList({
  materials,
  byId,
  loading,
  onChanged,
}: {
  materials: MaterialRow[];
  byId: Map<string, CategoryWithLocation>;
  loading: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<MaterialRow | null>(null);

  const deactivate = async (m: MaterialRow) => {
    if (!confirm(`¿Desactivar "${m.name}"? No se borra: deja de aparecer en el inventario activo.`))
      return;
    try {
      const res = await fetch(`/api/inventory/materials/${m.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "No se pudo desactivar");
      toast.success(`"${m.name}" desactivado`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-400 py-8 text-center">Cargando inventario…</p>;
  }
  if (materials.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-8 text-center">
        Aún no hay materiales cargados.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-border">
              <th className="py-2 px-2 font-semibold">Material</th>
              <th className="py-2 px-2 font-semibold">Categoría</th>
              <th className="py-2 px-2 font-semibold">Localización</th>
              <th className="py-2 px-2 font-semibold text-right">Stock</th>
              <th className="py-2 px-2 font-semibold text-right">Disp.</th>
              <th className="py-2 px-2 font-semibold">Estado</th>
              <th className="py-2 px-2 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => {
              const { label, location } = resolveCategory(m.category_id, byId);
              const asignado = m.estado_asignacion === "Asignado";
              return (
                <tr key={m.id} className="border-b border-border/60 hover:bg-muted/50">
                  <td className="py-2 px-2">
                    <div className="font-medium text-gray-800">{m.name}</div>
                    {m.unit && <div className="text-[11px] text-gray-400">{m.unit}</div>}
                  </td>
                  <td className="py-2 px-2 text-gray-600 text-xs">{label}</td>
                  <td className="py-2 px-2 text-gray-600 text-xs">{location}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{m.stock ?? 0}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-semibold">
                    {m.cantidad_disponible ?? 0}
                  </td>
                  <td className="py-2 px-2">
                    <span
                      className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        asignado
                          ? "bg-primary/10 text-primary"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {m.estado_asignacion}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setEditing(m)}
                      className="text-xs font-semibold text-primary hover:underline mr-3"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => deactivate(m)}
                      className="text-xs font-semibold text-crisis hover:underline"
                    >
                      Desactivar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditMaterialModal
          material={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function EditMaterialModal({
  material,
  onClose,
  onSaved,
}: {
  material: MaterialRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(material.name ?? "");
  const [unit, setUnit] = useState(material.unit ?? "");
  const [stock, setStock] = useState(String(material.stock ?? 0));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    const stockNum = Number(stock);
    if (!Number.isFinite(stockNum) || stockNum < 0) {
      toast.error("Stock inválido.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/inventory/materials/${material.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, unit: unit.trim() || null, stock: stockNum }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "No se pudo guardar");
      toast.success("Material actualizado");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl border border-border w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-gray-800">Editar material</h3>
        <div>
          <label className={labelCls}>Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Stock</label>
            <input
              type="number"
              min={0}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Unidad</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-gray-500 hover:text-gray-800 px-4 py-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-sm font-bold bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Categorías (CRUD) ──────────────────────────── */

function CategoriasPanel({
  categories,
  tops,
  loading,
  onChanged,
}: {
  categories: CategoryWithLocation[];
  tops: CategoryWithLocation[];
  loading: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [newName, setNewName] = useState("");
  const [newLoc, setNewLoc] = useState("");
  const [creating, setCreating] = useState(false);
  const [subFor, setSubFor] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/inventory/locations", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!j.error) setLocations(j.data ?? []);
      })
      .catch(() => {});
  }, []);

  const subsOf = (parentId: string) =>
    categories.filter((c) => c.parent_id === parentId);

  const createTop = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      toast.error("El nombre de la categoría es obligatorio.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/inventory/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, location_id: newLoc || null }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "No se pudo crear");
      toast.success(`Categoría "${name}" creada`);
      setNewName("");
      setNewLoc("");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setCreating(false);
    }
  };

  const deactivate = async (c: CategoryWithLocation) => {
    if (!confirm(`¿Desactivar "${c.name}"? Deja de aparecer en las listas activas.`)) return;
    try {
      const res = await fetch(`/api/inventory/categories/${c.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "No se pudo desactivar");
      toast.success(`"${c.name}" desactivado`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    }
  };

  const changeLocation = async (c: CategoryWithLocation, location_id: string) => {
    try {
      const res = await fetch(`/api/inventory/categories/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location_id: location_id || null }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "No se pudo actualizar");
      toast.success(`Localización de "${c.name}" actualizada`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    }
  };

  return (
    <div className="space-y-6">
      {/* Nueva categoría */}
      <form onSubmit={createTop} className="bg-muted border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          Nueva categoría
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <div>
            <label className={labelCls}>Nombre</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej: Material de laboratorio"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Localización</label>
            <select value={newLoc} onChange={(e) => setNewLoc(e.target.value)} className={inputCls}>
              <option value="">— Sin asignar —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="bg-gray-800 hover:bg-gray-900 text-white font-bold text-sm px-4 py-2.5 rounded-lg disabled:opacity-60"
          >
            {creating ? "…" : "Agregar"}
          </button>
        </div>
      </form>

      {/* Árbol de categorías */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Cargando categorías…</p>
      ) : (
        <div className="space-y-4">
          {tops.map((top) => {
            const subs = subsOf(top.id);
            return (
              <div key={top.id} className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-semibold text-gray-800">
                      {top.code ? `${top.code}. ` : ""}{top.name}
                    </span>
                    <span className="ml-2 text-[11px] text-gray-400">
                      {subs.length} subcategoría{subs.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={top.location_id ?? ""}
                      onChange={(e) => changeLocation(top, e.target.value)}
                      className="text-xs bg-white border border-border rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-ring"
                      title="Localización"
                    >
                      <option value="">📍 Sin localización</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          📍 {l.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setSubFor(subFor === top.id ? null : top.id)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      + Subcategoría
                    </button>
                    <button
                      type="button"
                      onClick={() => deactivate(top)}
                      className="text-xs font-semibold text-crisis hover:underline"
                    >
                      Desactivar
                    </button>
                  </div>
                </div>

                {subFor === top.id && (
                  <NewSubcategory parentId={top.id} onCreated={onChanged} onDone={() => setSubFor(null)} />
                )}

                {subs.length > 0 && (
                  <ul className="divide-y divide-border/60">
                    {subs.map((s) => (
                      <li key={s.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-sm text-gray-800">
                            {s.code ? `${s.code} ` : ""}{s.name}
                          </span>
                          {s.description && (
                            <p className="text-[11px] text-gray-400 truncate">{s.description}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => deactivate(s)}
                          className="text-xs font-semibold text-crisis hover:underline shrink-0"
                        >
                          Desactivar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewSubcategory({
  parentId,
  onCreated,
  onDone,
}: {
  parentId: string;
  onCreated: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("El nombre de la subcategoría es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, parent_id: parentId, description: description.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "No se pudo crear");
      toast.success(`Subcategoría "${trimmed}" creada`);
      onCreated();
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="bg-white px-4 py-3 border-t border-border grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
      <div>
        <label className={labelCls}>Nombre</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus />
      </div>
      <div>
        <label className={labelCls}>Descripción</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="bg-gray-800 hover:bg-gray-900 text-white font-bold text-sm px-4 py-2.5 rounded-lg disabled:opacity-60"
      >
        {saving ? "…" : "Guardar"}
      </button>
    </form>
  );
}
