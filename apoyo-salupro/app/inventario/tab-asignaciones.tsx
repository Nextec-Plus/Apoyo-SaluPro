"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast-provider";
import type {
  AssignmentStatus,
  InventoryMedicalCenter,
} from "@/lib/types/database";
import type { AssignmentRow, MaterialRow } from "./types";

const inputCls =
  "w-full text-sm bg-white border border-border rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-colors";
const textareaCls = inputCls + " resize-none";
const labelCls = "block text-xs font-semibold text-gray-700 mb-1";

type SubView = "despachar" | "historial" | "centros";

const STATUS_STYLES: Record<AssignmentStatus, string> = {
  Despachado: "bg-amber-100 text-amber-700",
  Recibido: "bg-primary/10 text-primary",
  Cancelado: "bg-gray-100 text-gray-400 line-through",
};

export function TabAsignaciones() {
  const toast = useToast();
  const [subView, setSubView] = useState<SubView>("despachar");
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [centers, setCenters] = useState<InventoryMedicalCenter[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMaterials = useCallback(async () => {
    const res = await fetch("/api/inventory/materials", { cache: "no-store" });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    setMaterials(json.data ?? []);
  }, []);

  const loadCenters = useCallback(async () => {
    const res = await fetch("/api/inventory/medical-centers", { cache: "no-store" });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    setCenters(json.data ?? []);
  }, []);

  const loadAssignments = useCallback(async () => {
    const res = await fetch("/api/inventory/assignments", { cache: "no-store" });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    setAssignments(json.data ?? []);
  }, []);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadMaterials(), loadCenters(), loadAssignments()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los datos");
    } finally {
      setLoading(false);
    }
  }, [loadMaterials, loadCenters, loadAssignments, toast]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-6">
      <div className="border-b border-border pb-3 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Asignaciones</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Despacho de materiales a centros médicos.
          </p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(
            [
              { v: "despachar", label: "Nuevo despacho" },
              { v: "historial", label: `Historial${assignments.length ? ` (${assignments.length})` : ""}` },
              { v: "centros", label: `Centros${centers.length ? ` (${centers.length})` : ""}` },
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

      {subView === "despachar" && (
        <DespacharForm
          materials={materials}
          centers={centers}
          loading={loading}
          onCreated={async () => {
            await Promise.all([loadMaterials(), loadAssignments()]);
          }}
          onGoCentros={() => setSubView("centros")}
        />
      )}
      {subView === "historial" && (
        <HistorialList
          assignments={assignments}
          loading={loading}
          onChanged={async () => {
            await Promise.all([loadMaterials(), loadAssignments()]);
          }}
        />
      )}
      {subView === "centros" && (
        <CentrosPanel centers={centers} loading={loading} onChanged={loadCenters} />
      )}
    </div>
  );
}

/* ───────────────────────────── Nuevo despacho ─────────────────────────────── */

function DespacharForm({
  materials,
  centers,
  loading,
  onCreated,
  onGoCentros,
}: {
  materials: MaterialRow[];
  centers: InventoryMedicalCenter[];
  loading: boolean;
  onCreated: () => Promise<void>;
  onGoCentros: () => void;
}) {
  const toast = useToast();
  const [materialId, setMaterialId] = useState("");
  const [centerId, setCenterId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selected = useMemo(
    () => materials.find((m) => m.id === materialId) ?? null,
    [materials, materialId],
  );
  const disponible = selected?.cantidad_disponible ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialId) return toast.error("Seleccione un material.");
    if (!centerId) return toast.error("Seleccione un centro médico.");
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Cantidad inválida.");
    if (qty > disponible)
      return toast.error(`Solo hay ${disponible} disponibles de "${selected?.name}".`);

    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material_id: materialId,
          medical_center_id: centerId,
          quantity: qty,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "No se pudo registrar el despacho");
      const centerName = centers.find((c) => c.id === centerId)?.name ?? "el centro";
      toast.success(`Despachados ${qty} de "${selected?.name}" a ${centerName}`);
      setQuantity("");
      setNotes("");
      await onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  if (!loading && centers.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-gray-500 mb-3">
          No hay centros médicos registrados. Cree uno antes de despachar.
        </p>
        <button
          type="button"
          onClick={onGoCentros}
          className="text-sm font-bold bg-gray-800 hover:bg-gray-900 text-white px-4 py-2.5 rounded-lg"
        >
          Ir a Centros
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Material</label>
          <select
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
            className={inputCls}
            disabled={loading}
          >
            <option value="">— Seleccione —</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id ?? ""} disabled={(m.cantidad_disponible ?? 0) <= 0}>
                {m.name} ({m.cantidad_disponible ?? 0} disp.)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Centro médico</label>
          <select
            value={centerId}
            onChange={(e) => setCenterId(e.target.value)}
            className={inputCls}
            disabled={loading}
          >
            <option value="">— Seleccione —</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>
            Cantidad
            {selected && (
              <span className="ml-2 font-normal text-gray-400">disp.: {disponible}</span>
            )}
          </label>
          <input
            type="number"
            min={1}
            max={disponible || undefined}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Notas (opcional)</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Responsable, observaciones del despacho…"
          className={textareaCls}
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 rounded-lg shadow-sm transition-colors text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? "REGISTRANDO…" : "REGISTRAR DESPACHO"}
      </button>
    </form>
  );
}

/* ───────────────────────────── Historial ──────────────────────────────────── */

function HistorialList({
  assignments,
  loading,
  onChanged,
}: {
  assignments: AssignmentRow[];
  loading: boolean;
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();

  const setStatus = async (a: AssignmentRow, status: AssignmentStatus) => {
    if (
      status === "Cancelado" &&
      !confirm("¿Cancelar este despacho? El stock vuelve a quedar disponible.")
    )
      return;
    try {
      const res = await fetch(`/api/inventory/assignments/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "No se pudo actualizar");
      toast.success(`Despacho marcado como ${status}`);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    }
  };

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Cargando historial…</p>;
  if (assignments.length === 0)
    return <p className="text-sm text-gray-400 py-8 text-center">Aún no hay despachos.</p>;

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm min-w-[680px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-border">
            <th className="py-2 px-2 font-semibold">Fecha</th>
            <th className="py-2 px-2 font-semibold">Material</th>
            <th className="py-2 px-2 font-semibold">Centro</th>
            <th className="py-2 px-2 font-semibold text-right">Cant.</th>
            <th className="py-2 px-2 font-semibold">Estado</th>
            <th className="py-2 px-2 font-semibold text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((a) => (
            <tr key={a.id} className="border-b border-border/60 hover:bg-muted/50">
              <td className="py-2 px-2 text-xs text-gray-500 whitespace-nowrap">
                {new Date(a.fecha).toLocaleDateString("es-VE")}
              </td>
              <td className="py-2 px-2 font-medium text-gray-800">{a.material?.name ?? "—"}</td>
              <td className="py-2 px-2 text-gray-600">{a.center?.name ?? "—"}</td>
              <td className="py-2 px-2 text-right tabular-nums">
                {a.quantity}
                {a.material?.unit ? ` ${a.material.unit}` : ""}
              </td>
              <td className="py-2 px-2">
                <span
                  className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[a.status]}`}
                >
                  {a.status}
                </span>
              </td>
              <td className="py-2 px-2 text-right whitespace-nowrap">
                {a.status === "Despachado" && (
                  <button
                    type="button"
                    onClick={() => setStatus(a, "Recibido")}
                    className="text-xs font-semibold text-primary hover:underline mr-3"
                  >
                    Recibido
                  </button>
                )}
                {a.status !== "Cancelado" && (
                  <button
                    type="button"
                    onClick={() => setStatus(a, "Cancelado")}
                    className="text-xs font-semibold text-crisis hover:underline"
                  >
                    Cancelar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────────── Centros médicos ────────────────────────────── */

function CentrosPanel({
  centers,
  loading,
  onChanged,
}: {
  centers: InventoryMedicalCenter[];
  loading: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [contact, setContact] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return toast.error("El nombre del centro es obligatorio.");
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/medical-centers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          location: location.trim() || null,
          phone: phone.trim() || null,
          contact: contact.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "No se pudo crear");
      toast.success(`Centro "${trimmed}" creado`);
      setName("");
      setLocation("");
      setPhone("");
      setContact("");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (c: InventoryMedicalCenter) => {
    if (!confirm(`¿Desactivar "${c.name}"?`)) return;
    try {
      const res = await fetch(`/api/inventory/medical-centers/${c.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "No se pudo desactivar");
      toast.success(`"${c.name}" desactivado`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="bg-muted border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          Nuevo centro médico
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Ej: Ambulatorio Macuto" />
          </div>
          <div>
            <label className={labelCls}>Ubicación</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} placeholder="Ej: Vargas, sector La Guaira" />
          </div>
          <div>
            <label className={labelCls}>Teléfono</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="0212-0000000" />
          </div>
          <div>
            <label className={labelCls}>Contacto</label>
            <input value={contact} onChange={(e) => setContact(e.target.value)} className={inputCls} placeholder="Responsable" />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-gray-800 hover:bg-gray-900 text-white font-bold text-sm px-4 py-2.5 rounded-lg disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Agregar centro"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Cargando centros…</p>
      ) : centers.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No hay centros registrados.</p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-lg">
          {centers.map((c) => (
            <li key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-800">{c.name}</p>
                <p className="text-[11px] text-gray-400 truncate">
                  {[c.location, c.phone, c.contact].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deactivate(c)}
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
}
