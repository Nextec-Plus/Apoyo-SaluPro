"use client";

import { useState } from "react";
import { useToast } from "@/components/toast-provider";
import {
  generoUiToDb,
  getClientOrganizationId,
  triageUiToDb,
  type TriageUiId,
} from "@/lib/config";
import { TRIAGE_UPDATED_EVENT } from "@/lib/events";

const SECTORES = [
  "Maiquetía", "Caraballeda", "Macuto", "La Guaira",
  "Naiguatá", "Caruao", "Tanaguarena", "Otro",
];

const DESTINOS = [
  "Dado de alta (Ambulatorio)",
  "En observación en módulo móvil",
  "Referido al Hospital José María Vargas",
  "Referido al Hospital Periférico de Pariata",
  "Trasladado a Refugio Oficial",
];

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">
      {number}. {title}
    </h3>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        {label}{required && <span className="text-crisis ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full text-sm bg-white border border-border rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-colors";

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function TabFicha() {
  const toast = useToast();
  const [triaje, setTriaje] = useState<TriageUiId>("verde");
  const [loading, setLoading] = useState(false);

  const triajeColors: Record<TriageUiId, string> = {
    verde:    "border-triage-green text-triage-green bg-green-50",
    amarillo: "border-triage-yellow text-triage-yellow bg-amber-50",
    rojo:     "border-triage-red text-triage-red bg-red-50",
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);

    const fd = new FormData(form);
    const organization_id = getClientOrganizationId();
    const nombre_completo = str(fd, "nombre_completo");

    if (!nombre_completo) {
      toast.error("El nombre completo es requerido.");
      setLoading(false);
      return;
    }

    try {
      const victimRes = await fetch("/api/catastrophe/victims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id,
          nombre_completo,
          cedula: str(fd, "cedula"),
          edad: fd.get("edad") ? Number(fd.get("edad")) : null,
          genero: generoUiToDb(String(fd.get("genero") ?? "")),
          telefono_contacto: str(fd, "telefono"),
          sector_comunidad: str(fd, "sector"),
          nombre_edificio_casa: str(fd, "edificio"),
          numero_apartamento_casa: str(fd, "apto"),
          ubicacion_actual_refugio: str(fd, "ubicacion"),
          notas: str(fd, "destino"),
        }),
      });
      const victimJson = await victimRes.json();
      if (!victimRes.ok || !victimJson.data) {
        throw new Error(victimJson.error ?? "No se pudo registrar al paciente");
      }

      const caseRes = await fetch("/api/catastrophe/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id,
          victim_id: victimJson.data.id,
          triage_category: triageUiToDb(triaje),
          motivo_principal_consulta: str(fd, "motivo"),
          condiciones_preexistentes: str(fd, "condiciones"),
          tratamiento_medicamentos: str(fd, "tratamiento"),
        }),
      });
      const caseJson = await caseRes.json();
      if (!caseRes.ok || caseJson.error) {
        throw new Error(caseJson.error ?? "No se pudo registrar el caso de triaje");
      }

      const contactoRaw = str(fd, "contacto_emergencia");
      const telefonoContacto = str(fd, "telefono_contacto");
      if (contactoRaw) {
        const match = contactoRaw.match(/^(.+?)\s*\((.+)\)\s*$/);
        await fetch(`/api/catastrophe/victims/${victimJson.data.id}/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organization_id,
            nombre_contacto: match?.[1]?.trim() ?? contactoRaw,
            relacion: match?.[2]?.trim() ?? "Contacto",
            telefono_nacional: telefonoContacto,
            is_emergency_contact: true,
          }),
        });
      }

      const categoria = triageUiToDb(triaje);
      form.reset();
      setTriaje("verde");
      window.dispatchEvent(new CustomEvent(TRIAGE_UPDATED_EVENT));
      toast.success(
        `Paciente registrado (${categoria}). Ya aparece en el tablero de Triaje.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el registro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-6">
      <div className="border-b border-border pb-3 mb-6">
        <h2 className="text-lg font-bold text-gray-800">Admisión e Ingreso de Pacientes</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Catalogación rápida de víctimas y estado de salud en sitio.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* 1. Identidad */}
        <section className="bg-muted rounded-lg border border-border p-4 space-y-4">
          <SectionHeader number="1" title="Identidad del Paciente" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Nombre Completo" required>
              <input type="text" name="nombre_completo" required placeholder="Nombre y apellido" className={inputCls} />
            </Field>
            <Field label="Cédula de Identidad">
              <input type="text" name="cedula" placeholder="V-00000000" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Edad">
                <input type="number" name="edad" min="0" max="120" className={inputCls} />
              </Field>
              <Field label="Género">
                <select name="genero" className={inputCls} defaultValue="Masculino">
                  <option>Masculino</option>
                  <option>Femenino</option>
                  <option>Otro</option>
                </select>
              </Field>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Teléfono">
              <input type="tel" name="telefono" placeholder="04XX-XXXXXXX" className={inputCls} />
            </Field>
            <Field label="Contacto de Emergencia">
              <input type="text" name="contacto_emergencia" placeholder="Nombre (Parentesco)" className={inputCls} />
            </Field>
            <Field label="Teléfono del Contacto">
              <input type="tel" name="telefono_contacto" className={inputCls} />
            </Field>
          </div>
        </section>

        {/* 2. Dirección */}
        <section className="bg-muted rounded-lg border border-border p-4 space-y-4">
          <SectionHeader number="2" title="Dirección de Residencia Pre-Sismo" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Sector o Comunidad" required>
              <select name="sector" required className={inputCls} defaultValue="">
                <option value="">Seleccionar…</option>
                {SECTORES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Edificio o Casa">
              <input type="text" name="edificio" placeholder="Residencias El Mar, Torre B…" className={inputCls} />
            </Field>
            <Field label="Nro. Apto / Casa">
              <input type="text" name="apto" className={inputCls} />
            </Field>
          </div>
          <Field label="Ubicación Actual / Refugio Asignado">
            <input
              type="text"
              name="ubicacion"
              placeholder="Ej: Cancha Infante, Escuela Panamá, Módulo móvil…"
              className={inputCls}
            />
          </Field>
        </section>

        {/* 3. Evaluación médica */}
        <section className="bg-muted rounded-lg border border-border p-4 space-y-4">
          <SectionHeader number="3" title="Evaluación Médica Inicial" />

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Clasificación de Triaje<span className="text-crisis ml-0.5">*</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {[
                { id: "verde" as const,    label: "🟢 VERDE — Leve / Ambulatorio" },
                { id: "amarillo" as const, label: "🟡 AMARILLO — Moderado / Observación" },
                { id: "rojo" as const,     label: "🔴 ROJO — Grave / Emergencia Inmediata" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTriaje(id)}
                  className={[
                    "flex-1 min-w-[180px] text-xs font-semibold py-2.5 px-3 rounded-lg border-2 transition-all text-left",
                    triaje === id
                      ? triajeColors[id]
                      : "border-border text-gray-500 bg-white hover:border-gray-300",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Sintomatología / Motivo de Consulta" required>
            <input
              type="text"
              name="motivo"
              required
              placeholder="Ej: Herida abierta, crisis asmática, sospecha de fractura…"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Alergias o Enfermedades Crónicas">
              <input
                type="text"
                name="condiciones"
                placeholder="Ej: Diabético, Hipertenso, Alergia a Penicilina…"
                className={inputCls}
              />
            </Field>
            <Field label="Tratamiento o Medicación Entregada">
              <input
                type="text"
                name="tratamiento"
                placeholder="Medicamentos suministrados en sitio…"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Estatus / Destino del Paciente">
            <select name="destino" className={inputCls} defaultValue={DESTINOS[0]}>
              {DESTINOS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </section>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3.5 rounded-lg
            shadow-sm transition-colors text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Guardando…" : "💾 GUARDAR REGISTRO MÉDICO"}
        </button>
      </form>
    </div>
  );
}
