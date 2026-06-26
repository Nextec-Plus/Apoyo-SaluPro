"use client";

import { useCallback, useEffect, useState } from "react";
import { VictimDocuments } from "@/components/victim-documents";
import { useToast } from "@/components/toast-provider";
import { generoDbToUi, generoUiToDb, getClientOrganizationId } from "@/lib/config";
import { TRIAGE_UPDATED_EVENT } from "@/lib/events";
import {
  formatFoundMatchesNotice,
  notifyFoundMatches,
} from "@/lib/found-matches-notice";
import type { FoundMatchResult } from "@/lib/missing-person-match";
import {
  DESTINOS,
  destinoToCareState,
  formatDestino,
  isReferidoHospital,
  parseDestino,
} from "@/lib/catastrophe-destinos";
import type {
  CatastropheFamilyContact,
  CatastropheVictim,
  CatastropheVictimInfo,
  TriageCategory,
} from "@/lib/types/database";

const SECTORES = [
  "Maiquetía", "Caraballeda", "Macuto", "La Guaira",
  "Naiguatá", "Caruao", "Tanaguarena", "Otro",
];

const inputCls =
  "w-full text-sm bg-white border border-border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary";

type VictimDetail = CatastropheVictim & {
  catastrophe_victim_info: CatastropheVictimInfo | CatastropheVictimInfo[] | null;
  catastrophe_family_contacts: CatastropheFamilyContact[] | null;
};

type PatientForm = {
  nombre_completo: string;
  cedula: string;
  edad: string;
  genero: string;
  telefono_contacto: string;
  sector_comunidad: string;
  nombre_edificio_casa: string;
  numero_apartamento_casa: string;
  ubicacion_actual_refugio: string;
  triage_category: TriageCategory;
  motivo_principal_consulta: string;
  condiciones_preexistentes: string;
  alergias: string;
  tratamiento_medicamentos: string;
  destino: string;
  hospital_destino: string;
};

type ContactForm = {
  nombre_contacto: string;
  relacion: string;
  telefono_nacional: string;
  telefono_internacional: string;
  is_emergency_contact: boolean;
  notas: string;
};

const emptyContactForm = (): ContactForm => ({
  nombre_contacto: "",
  relacion: "",
  telefono_nacional: "",
  telefono_internacional: "",
  is_emergency_contact: true,
  notas: "",
});

function getInfo(victim: VictimDetail): CatastropheVictimInfo | null {
  const info = victim.catastrophe_victim_info;
  if (!info) return null;
  return Array.isArray(info) ? info[0] ?? null : info;
}

function victimToForm(victim: VictimDetail, info: CatastropheVictimInfo | null): PatientForm {
  const { destino, hospital } = parseDestino(victim.notas);
  return {
    nombre_completo: victim.nombre_completo ?? "",
    cedula: victim.cedula ?? "",
    edad: victim.edad != null ? String(victim.edad) : "",
    genero: generoDbToUi(victim.genero) === "—" ? "Masculino" : generoDbToUi(victim.genero),
    telefono_contacto: victim.telefono_contacto ?? "",
    sector_comunidad: victim.sector_comunidad ?? "",
    nombre_edificio_casa: victim.nombre_edificio_casa ?? "",
    numero_apartamento_casa: victim.numero_apartamento_casa ?? "",
    ubicacion_actual_refugio: victim.ubicacion_actual_refugio ?? "",
    triage_category: info?.triage_category ?? "Verde",
    motivo_principal_consulta: info?.motivo_principal_consulta ?? "",
    condiciones_preexistentes: info?.condiciones_preexistentes ?? "",
    alergias: info?.alergias ?? "",
    tratamiento_medicamentos: info?.tratamiento_medicamentos ?? "",
    destino,
    hospital_destino: hospital,
  };
}

function contactToForm(c: CatastropheFamilyContact): ContactForm {
  return {
    nombre_contacto: c.nombre_contacto,
    relacion: c.relacion,
    telefono_nacional: c.telefono_nacional ?? "",
    telefono_internacional: c.telefono_internacional ?? "",
    is_emergency_contact: c.is_emergency_contact,
    notas: c.notas ?? "",
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function DataField({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === null || value === undefined || value === "" || value === "—") return null;
  return (
    <div className="py-1.5 border-b border-border/40 last:border-0">
      <dt className="text-[10px] text-gray-500">{label}</dt>
      <dd className="text-xs font-medium text-gray-900 mt-0.5 leading-snug">{value}</dd>
    </div>
  );
}

function BlockTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 pb-1 border-b border-border/60">
      {children}
    </h3>
  );
}

function triageStyle(category: string | null | undefined) {
  if (category === "Verde") return "border-triage-green text-triage-green bg-green-50";
  if (category === "Amarillo") return "border-triage-yellow text-triage-yellow bg-amber-50";
  if (category === "Rojo") return "border-triage-red text-triage-red bg-red-50";
  return "border-border text-gray-600 bg-white";
}

export function PatientModal({
  victimId,
  onClose,
  onUpdated,
}: {
  victimId: string;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const toast = useToast();
  const orgId = getClientOrganizationId();
  const [victim, setVictim] = useState<VictimDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PatientForm | null>(null);
  const [sendingSaluPro, setSendingSaluPro] = useState(false);
  const [confirmSaluPro, setConfirmSaluPro] = useState(false);

  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState<ContactForm>(emptyContactForm);
  const [savingContact, setSavingContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContactForm, setEditContactForm] = useState<ContactForm>(emptyContactForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/catastrophe/victims/${victimId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Paciente no encontrado");
      setVictim(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar paciente");
    } finally {
      setLoading(false);
    }
  }, [victimId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setEditing(false);
    setForm(null);
    setShowAddContact(false);
    setEditingContactId(null);
    setNewContact(emptyContactForm());
  }, [victimId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const info = victim ? getInfo(victim) : null;
  const contacts = victim?.catastrophe_family_contacts ?? [];

  const startEditing = () => {
    if (!victim) return;
    setForm(victimToForm(victim, info));
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setForm(null);
  };

  const sendToSaluPro = async () => {
    setSendingSaluPro(true);
    try {
      const res = await fetch(`/api/catastrophe/victims/${victimId}/send-to-salupro`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al enviar a SaluPro");
      toast.success("Consulta enviada a SaluPro correctamente");
      // Actualizar estado local para reflejar que ya fue enviado
      setVictim((prev) => {
        if (!prev) return prev;
        const sentAt = new Date().toISOString();
        const prevInfo = prev.catastrophe_victim_info;
        const updatedInfo = Array.isArray(prevInfo)
          ? prevInfo.map((i, idx) => idx === 0 ? { ...i, salupro_sent_at: sentAt } : i)
          : prevInfo ? { ...prevInfo, salupro_sent_at: sentAt } : prevInfo;
        return { ...prev, catastrophe_victim_info: updatedInfo };
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar a SaluPro");
    } finally {
      setSendingSaluPro(false);
    }
  };

  const updateForm = (patch: Partial<PatientForm>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const savePatient = async () => {
    if (!form || !victim) return;
    if (!form.nombre_completo.trim()) {
      toast.error("El nombre completo es requerido.");
      return;
    }

    setSaving(true);
    try {
      const victimRes = await fetch(`/api/catastrophe/victims/${victimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_completo: form.nombre_completo.trim(),
          cedula: form.cedula.trim() || null,
          edad: form.edad ? Number(form.edad) : null,
          genero: generoUiToDb(form.genero),
          telefono_contacto: form.telefono_contacto.trim() || null,
          sector_comunidad: form.sector_comunidad || null,
          nombre_edificio_casa: form.nombre_edificio_casa.trim() || null,
          numero_apartamento_casa: form.numero_apartamento_casa.trim() || null,
          ubicacion_actual_refugio: form.ubicacion_actual_refugio.trim() || null,
          notas: formatDestino(form.destino, form.hospital_destino) || null,
        }),
      });
      const victimJson = await victimRes.json();
      if (!victimRes.ok) throw new Error(victimJson.error ?? "Error al guardar paciente");

      const foundMatches = (victimJson.found_matches ?? []) as FoundMatchResult[];

      const infoBody = {
        triage_category: form.triage_category,
        estado_destino: destinoToCareState(form.destino),
        motivo_principal_consulta: form.motivo_principal_consulta.trim() || null,
        condiciones_preexistentes: form.condiciones_preexistentes.trim() || null,
        alergias: form.alergias.trim() || null,
        tratamiento_medicamentos: form.tratamiento_medicamentos.trim() || null,
      };

      let infoRes: Response;
      if (info) {
        infoRes = await fetch(`/api/catastrophe/victims/${victimId}/info`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(infoBody),
        });
      } else {
        infoRes = await fetch(`/api/catastrophe/victims/${victimId}/info`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organization_id: orgId, ...infoBody }),
        });
      }
      const infoJson = await infoRes.json();
      if (!infoRes.ok) throw new Error(infoJson.error ?? "Error al guardar evaluación médica");

      toast.success(formatFoundMatchesNotice(foundMatches) ?? "Ficha actualizada");
      notifyFoundMatches(foundMatches);
      setEditing(false);
      setForm(null);
      window.dispatchEvent(new CustomEvent(TRIAGE_UPDATED_EVENT));
      onUpdated?.();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const addContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.nombre_contacto.trim() || !newContact.relacion.trim()) {
      toast.error("Nombre y parentesco son requeridos.");
      return;
    }
    if (!newContact.telefono_nacional.trim() && !newContact.telefono_internacional.trim()) {
      toast.error("Indica al menos un teléfono.");
      return;
    }

    setSavingContact(true);
    try {
      const res = await fetch(`/api/catastrophe/victims/${victimId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: orgId,
          nombre_contacto: newContact.nombre_contacto.trim(),
          relacion: newContact.relacion.trim(),
          telefono_nacional: newContact.telefono_nacional.trim() || null,
          telefono_internacional: newContact.telefono_internacional.trim() || null,
          is_emergency_contact: newContact.is_emergency_contact,
          notas: newContact.notas.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al agregar contacto");
      toast.success("Contacto agregado");
      setNewContact(emptyContactForm());
      setShowAddContact(false);
      onUpdated?.();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al agregar contacto");
    } finally {
      setSavingContact(false);
    }
  };

  const saveContactEdit = async (contactId: string) => {
    if (!editContactForm.nombre_contacto.trim() || !editContactForm.relacion.trim()) {
      toast.error("Nombre y parentesco son requeridos.");
      return;
    }

    setSavingContact(true);
    try {
      const res = await fetch(
        `/api/catastrophe/victims/${victimId}/contacts/${contactId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre_contacto: editContactForm.nombre_contacto.trim(),
            relacion: editContactForm.relacion.trim(),
            telefono_nacional: editContactForm.telefono_nacional.trim() || null,
            telefono_internacional: editContactForm.telefono_internacional.trim() || null,
            is_emergency_contact: editContactForm.is_emergency_contact,
            notas: editContactForm.notas.trim() || null,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al actualizar contacto");
      toast.success("Contacto actualizado");
      setEditingContactId(null);
      onUpdated?.();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar contacto");
    } finally {
      setSavingContact(false);
    }
  };

  const deleteContact = async (contactId: string, name: string) => {
    if (!confirm(`¿Eliminar contacto "${name}"?`)) return;
    try {
      const res = await fetch(
        `/api/catastrophe/victims/${victimId}/contacts/${contactId}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al eliminar");
      toast.success("Contacto eliminado");
      onUpdated?.();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar contacto");
    }
  };

  const contactFormFields = (
    data: ContactForm,
    onChange: (patch: Partial<ContactForm>) => void,
  ) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Nombre">
        <input
          type="text"
          value={data.nombre_contacto}
          onChange={(e) => onChange({ nombre_contacto: e.target.value })}
          className={inputCls}
          placeholder="Nombre del contacto"
        />
      </Field>
      <Field label="Parentesco / Relación">
        <input
          type="text"
          value={data.relacion}
          onChange={(e) => onChange({ relacion: e.target.value })}
          className={inputCls}
          placeholder="Ej: Madre, Esposo, Hermano"
        />
      </Field>
      <Field label="Teléfono nacional">
        <input
          type="tel"
          value={data.telefono_nacional}
          onChange={(e) => onChange({ telefono_nacional: e.target.value })}
          className={inputCls}
          placeholder="04XX-XXXXXXX"
        />
      </Field>
      <Field label="Teléfono internacional">
        <input
          type="tel"
          value={data.telefono_internacional}
          onChange={(e) => onChange({ telefono_internacional: e.target.value })}
          className={inputCls}
          placeholder="+1 XXX XXX XXXX"
        />
      </Field>
      <Field label="Notas">
        <input
          type="text"
          value={data.notas}
          onChange={(e) => onChange({ notas: e.target.value })}
          className={inputCls}
          placeholder="Opcional"
        />
      </Field>
      <div className="flex items-end">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer pb-2">
          <input
            type="checkbox"
            checked={data.is_emergency_contact}
            onChange={(e) => onChange({ is_emergency_contact: e.target.checked })}
            className="rounded border-border"
          />
          Contacto de emergencia principal
        </label>
      </div>
    </div>
  );

  if (confirmSaluPro && victim) {
    return (
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
          onClick={() => setConfirmSaluPro(false)}
          aria-label="Cancelar"
        />
        <div className="relative bg-white rounded-2xl shadow-2xl border border-border w-full max-w-sm p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <img src="/isotipo_salupro_light.png" alt="SaluPro" className="w-8 h-8 object-contain" />
            <h2 className="text-base font-bold text-gray-900">Enviar a SaluPro</h2>
          </div>
          <p className="text-sm text-gray-600">
            ¿Confirmas que deseas enviar el caso de{" "}
            <span className="font-semibold text-gray-900">{victim.nombre_completo}</span>{" "}
            {victim.cedula && <span className="text-gray-500">(CI: {victim.cedula})</span>}{" "}
            a SaluPro como consulta externa?
          </p>
          <p className="text-xs text-gray-400">
            Esta acción no se puede deshacer. El caso quedará en estado <strong>PENDIENTE</strong> en SaluPro.
          </p>
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => setConfirmSaluPro(false)}
              className="text-sm font-medium text-gray-600 border border-border rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={sendingSaluPro}
              onClick={() => { setConfirmSaluPro(false); sendToSaluPro(); }}
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 border border-teal-700 rounded-lg px-4 py-2 disabled:opacity-60 transition-colors"
            >
              <img src="/isotipo_salupro_light.png" alt="" className="w-4 h-4 object-contain" />
              Confirmar envío
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="patient-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Cerrar"
      />

      <div className="relative w-full sm:max-w-6xl lg:max-w-[min(96vw,1280px)] max-h-[92dvh] sm:max-h-[90dvh] flex flex-col overflow-hidden overscroll-contain rounded-t-2xl sm:rounded-2xl bg-white border border-border shadow-2xl">
        {/* Header */}
        <div className="shrink-0 border-b border-border px-5 py-4 flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="patient-modal-title" className="text-lg font-bold text-gray-900 truncate">
                {loading ? "Cargando…" : victim?.nombre_completo ?? "Paciente"}
              </h2>
              {victim?.registration_number && (
                <span className="text-xs font-mono text-gray-400 bg-muted px-2 py-0.5 rounded">
                  {victim.registration_number}
                </span>
              )}
              {!editing && info?.triage_category && (
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${triageStyle(info.triage_category)}`}>
                  {info.triage_category}
                </span>
              )}
            </div>
            {victim && !editing && (
              <p className="text-xs text-gray-500 mt-1 truncate">
                {[victim.cedula, victim.edad ? `${victim.edad} años` : null, generoDbToUi(victim.genero), info?.motivo_principal_consulta]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {victim && editing && (
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="text-xs font-semibold text-gray-600 border border-border rounded-lg px-3 py-2 hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
            )}
            {victim && !editing && !loading && (
              <>
                {info?.salupro_sent_at ? (
                  <span
                    title={`Enviado el ${new Date(info.salupro_sent_at).toLocaleString('es-VE')}`}
                    className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 cursor-default"
                  >
                    <img src="/isotipo_salupro_light.png" alt="" className="w-4 h-4 object-contain opacity-70" />
                    Enviado a SaluPro
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmSaluPro(true)}
                    disabled={sendingSaluPro || !victim.cedula}
                    title={!victim.cedula ? "Se requiere cédula para enviar a SaluPro" : "Enviar consulta a SaluPro"}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 border border-teal-700 rounded-lg px-3 py-2 disabled:opacity-60 transition-colors"
                  >
                    <img src="/isotipo_salupro_light.png" alt="" className="w-4 h-4 object-contain" />
                    {sendingSaluPro ? "Enviando…" : "Enviar a SaluPro"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={startEditing}
                  className="text-xs font-semibold text-primary border border-primary/30 rounded-lg px-3 py-2 bg-primary/5 hover:text-primary-dark transition-colors"
                >
                  Editar ficha
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors"
              aria-label="Cerrar"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-16 text-center">Cargando ficha…</p>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-crisis text-sm">{error}</p>
          </div>
        ) : victim ? (
          <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[1.55fr_1fr] lg:divide-x divide-border">
            {/* Ficha — arriba en móvil, derecha en desktop */}
            <div className="flex flex-col min-h-0 order-1 lg:order-2 border-b lg:border-b-0 border-border">
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                {editing && form ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <BlockTitle>Datos personales</BlockTitle>
                      <Field label="Nombre completo">
                        <input type="text" value={form.nombre_completo} onChange={(e) => updateForm({ nombre_completo: e.target.value })} className={inputCls} required />
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Cédula">
                          <input type="text" value={form.cedula} onChange={(e) => updateForm({ cedula: e.target.value })} className={inputCls} />
                        </Field>
                        <Field label="Edad">
                          <input type="number" min="0" max="120" value={form.edad} onChange={(e) => updateForm({ edad: e.target.value })} className={inputCls} />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Género">
                          <select value={form.genero} onChange={(e) => updateForm({ genero: e.target.value })} className={inputCls}>
                            <option>Masculino</option><option>Femenino</option><option>Otro</option>
                          </select>
                        </Field>
                        <Field label="Teléfono">
                          <input type="tel" value={form.telefono_contacto} onChange={(e) => updateForm({ telefono_contacto: e.target.value })} className={inputCls} />
                        </Field>
                      </div>
                      <BlockTitle>Ubicación</BlockTitle>
                      <Field label="Sector / Comunidad">
                        <select value={form.sector_comunidad} onChange={(e) => updateForm({ sector_comunidad: e.target.value })} className={inputCls}>
                          <option value="">Seleccionar…</option>
                          {SECTORES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </Field>
                      <Field label="Edificio o casa">
                        <input type="text" value={form.nombre_edificio_casa} onChange={(e) => updateForm({ nombre_edificio_casa: e.target.value })} className={inputCls} />
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Apto / Casa">
                          <input type="text" value={form.numero_apartamento_casa} onChange={(e) => updateForm({ numero_apartamento_casa: e.target.value })} className={inputCls} />
                        </Field>
                        <Field label="Refugio actual">
                          <input type="text" value={form.ubicacion_actual_refugio} onChange={(e) => updateForm({ ubicacion_actual_refugio: e.target.value })} className={inputCls} />
                        </Field>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <BlockTitle>Evaluación médica</BlockTitle>
                      <Field label="Triaje">
                        <select value={form.triage_category} onChange={(e) => updateForm({ triage_category: e.target.value as TriageCategory })} className={inputCls}>
                          <option value="Verde">🟢 Verde — Leve</option>
                          <option value="Amarillo">🟡 Amarillo — Moderado</option>
                          <option value="Rojo">🔴 Rojo — Grave</option>
                        </select>
                      </Field>
                      <Field label="Motivo de consulta">
                        <input type="text" value={form.motivo_principal_consulta} onChange={(e) => updateForm({ motivo_principal_consulta: e.target.value })} className={inputCls} />
                      </Field>
                      <Field label="Condiciones preexistentes">
                        <input type="text" value={form.condiciones_preexistentes} onChange={(e) => updateForm({ condiciones_preexistentes: e.target.value })} className={inputCls} />
                      </Field>
                      <Field label="Alergias">
                        <input type="text" value={form.alergias} onChange={(e) => updateForm({ alergias: e.target.value })} className={inputCls} />
                      </Field>
                      <Field label="Tratamiento / Medicamentos">
                        <input type="text" value={form.tratamiento_medicamentos} onChange={(e) => updateForm({ tratamiento_medicamentos: e.target.value })} className={inputCls} />
                      </Field>
                      <Field label="Destino del paciente">
                        <select
                          value={form.destino}
                          onChange={(e) => {
                            const destino = e.target.value;
                            updateForm({
                              destino,
                              hospital_destino: isReferidoHospital(destino) ? form.hospital_destino : "",
                            });
                          }}
                          className={inputCls}
                        >
                          {DESTINOS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </Field>
                      {isReferidoHospital(form.destino) && (
                        <Field label="Hospital / Clínica de destino">
                          <input
                            type="text"
                            value={form.hospital_destino}
                            onChange={(e) => updateForm({ hospital_destino: e.target.value })}
                            className={inputCls}
                            placeholder="Ej: Hospital José María Vargas, Clínica…"
                          />
                        </Field>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <BlockTitle>Datos personales</BlockTitle>
                      <dl className="grid grid-cols-2 gap-x-3">
                        <DataField label="Nombre" value={victim.nombre_completo} />
                        <DataField label="Cédula" value={victim.cedula} />
                        <DataField label="Edad" value={victim.edad ? `${victim.edad} años` : null} />
                        <DataField label="Género" value={generoDbToUi(victim.genero)} />
                        <DataField label="Teléfono" value={victim.telefono_contacto} />
                      </dl>
                      <BlockTitle>Ubicación</BlockTitle>
                      <dl className="grid grid-cols-2 gap-x-3">
                        <DataField label="Sector" value={victim.sector_comunidad} />
                        <DataField label="Edificio" value={victim.nombre_edificio_casa} />
                        <DataField label="Apto" value={victim.numero_apartamento_casa} />
                        <DataField label="Refugio" value={victim.ubicacion_actual_refugio} />
                      </dl>
                    </div>
                    <div>
                      <BlockTitle>Evaluación médica</BlockTitle>
                      {info?.triage_category && (
                        <div className={`mb-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${triageStyle(info.triage_category)}`}>
                          {info.triage_category}
                          {info.estado_destino && <span className="font-normal ml-1 opacity-75">· {info.estado_destino}</span>}
                        </div>
                      )}
                      <dl className="grid grid-cols-1 gap-x-3">
                        <DataField label="Motivo" value={info?.motivo_principal_consulta} />
                        <DataField label="Condiciones" value={info?.condiciones_preexistentes} />
                        <DataField label="Alergias" value={info?.alergias} />
                        <DataField label="Tratamiento" value={info?.tratamiento_medicamentos} />
                        <DataField label="Destino" value={victim.notas} />
                        <DataField
                          label="Ingreso"
                          value={info?.fecha_hora_entrada
                            ? new Date(info.fecha_hora_entrada).toLocaleString("es-VE", { timeZone: "America/Caracas", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                            : null}
                        />
                      </dl>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2 pb-1 border-b border-border/60">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Contactos de emergencia
                    </h3>
                    {!showAddContact && (
                      <button
                        type="button"
                        onClick={() => setShowAddContact(true)}
                        className="text-[10px] font-semibold text-primary hover:text-primary-dark"
                      >
                        + Agregar
                      </button>
                    )}
                  </div>
                  {showAddContact && (
                    <form onSubmit={addContact} className="border border-border rounded-lg p-3 space-y-3 bg-muted/30 mb-3">
                      {contactFormFields(newContact, (patch) => setNewContact((prev) => ({ ...prev, ...patch })))}
                      <div className="flex gap-2">
                        <button type="submit" disabled={savingContact} className="text-xs font-semibold bg-primary text-white px-3 py-1.5 rounded-lg disabled:opacity-60">
                          {savingContact ? "Guardando…" : "Guardar"}
                        </button>
                        <button type="button" onClick={() => { setShowAddContact(false); setNewContact(emptyContactForm()); }} className="text-xs text-gray-500 px-3 py-1.5">
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}
                  {contacts.length === 0 && !showAddContact ? (
                    <p className="text-xs text-gray-400 py-2">Sin contactos registrados</p>
                  ) : (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
                      {contacts.map((c) => (
                        <li key={c.id} className="border border-border rounded-lg p-2.5 bg-white text-sm">
                          {editingContactId === c.id ? (
                            <div className="space-y-2">
                              {contactFormFields(editContactForm, (patch) => setEditContactForm((prev) => ({ ...prev, ...patch })))}
                              <div className="flex gap-2">
                                <button type="button" onClick={() => saveContactEdit(c.id)} disabled={savingContact} className="text-xs font-semibold bg-primary text-white px-2 py-1 rounded disabled:opacity-60">Guardar</button>
                                <button type="button" onClick={() => setEditingContactId(null)} className="text-xs text-gray-500 px-2 py-1">Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-800 truncate text-xs">
                                  {c.nombre_contacto}
                                  {c.is_emergency_contact && (
                                    <span className="ml-1 text-[8px] font-bold uppercase text-crisis bg-crisis-light px-1 rounded">SOS</span>
                                  )}
                                </p>
                                <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                                  {[c.relacion, c.telefono_nacional].filter(Boolean).join(" · ")}
                                </p>
                              </div>
                              <div className="flex gap-1.5 shrink-0 text-[10px]">
                                <button type="button" onClick={() => { setEditingContactId(c.id); setEditContactForm(contactToForm(c)); }} className="text-primary hover:underline">Editar</button>
                                <button type="button" onClick={() => deleteContact(c.id, c.nombre_contacto)} className="text-crisis hover:underline">✕</button>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {editing && form && (
                <div className="shrink-0 p-4 border-t border-border bg-white">
                  <button
                    type="button"
                    onClick={savePatient}
                    disabled={saving}
                    className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-2.5 rounded-lg text-sm disabled:opacity-60"
                  >
                    {saving ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>
              )}
            </div>

            {/* Documentos — abajo en móvil, izquierda en desktop */}
            <div className="flex flex-col min-h-0 flex-1 order-2 lg:order-1 bg-muted/40 p-4 lg:p-5 min-h-[45vh] lg:min-h-0">
              <VictimDocuments victimId={victim.id} organizationId={orgId} variant="panel" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
