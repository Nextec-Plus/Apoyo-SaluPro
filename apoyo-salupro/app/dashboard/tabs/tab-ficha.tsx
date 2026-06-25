"use client";

import { useState } from "react";

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

export function TabFicha() {
  const [submitted, setSubmitted] = useState(false);
  const [triaje, setTriaje] = useState("verde");

  const triajeColors: Record<string, string> = {
    verde:    "border-triage-green text-triage-green bg-green-50",
    amarillo: "border-triage-yellow text-triage-yellow bg-amber-50",
    rojo:     "border-triage-red text-triage-red bg-red-50",
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
    (e.target as HTMLFormElement).reset();
    setTriaje("verde");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-6">
      <div className="border-b border-border pb-3 mb-6">
        <h2 className="text-lg font-bold text-gray-800">Admisión e Ingreso de Pacientes</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Catalogación rápida de víctimas y estado de salud en sitio.
        </p>
      </div>

      {submitted && (
        <div className="mb-5 bg-primary-light border border-primary/30 text-primary rounded-lg px-4 py-3 text-sm font-medium">
          ✅ Registro médico guardado con éxito.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* 1. Identidad */}
        <section className="bg-muted rounded-lg border border-border p-4 space-y-4">
          <SectionHeader number="1" title="Identidad del Paciente" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Nombre Completo" required>
              <input type="text" required placeholder="Nombre y apellido" className={inputCls} />
            </Field>
            <Field label="Cédula de Identidad">
              <input type="text" placeholder="V-00000000" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Edad">
                <input type="number" min="0" max="120" className={inputCls} />
              </Field>
              <Field label="Género">
                <select className={inputCls}>
                  <option>Masculino</option>
                  <option>Femenino</option>
                  <option>Otro</option>
                </select>
              </Field>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Teléfono">
              <input type="tel" placeholder="04XX-XXXXXXX" className={inputCls} />
            </Field>
            <Field label="Contacto de Emergencia">
              <input type="text" placeholder="Nombre (Parentesco)" className={inputCls} />
            </Field>
            <Field label="Teléfono del Contacto">
              <input type="tel" className={inputCls} />
            </Field>
          </div>
        </section>

        {/* 2. Dirección */}
        <section className="bg-muted rounded-lg border border-border p-4 space-y-4">
          <SectionHeader number="2" title="Dirección de Residencia Pre-Sismo" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Sector o Comunidad" required>
              <select required className={inputCls}>
                <option value="">Seleccionar…</option>
                {SECTORES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Edificio o Casa">
              <input type="text" placeholder="Residencias El Mar, Torre B…" className={inputCls} />
            </Field>
            <Field label="Nro. Apto / Casa">
              <input type="text" className={inputCls} />
            </Field>
          </div>
          <Field label="Ubicación Actual / Refugio Asignado">
            <input
              type="text"
              placeholder="Ej: Cancha Infante, Escuela Panamá, Módulo móvil…"
              className={inputCls}
            />
          </Field>
        </section>

        {/* 3. Evaluación médica */}
        <section className="bg-muted rounded-lg border border-border p-4 space-y-4">
          <SectionHeader number="3" title="Evaluación Médica Inicial" />

          {/* Selector triaje visual */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Clasificación de Triaje<span className="text-crisis ml-0.5">*</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {[
                { id: "verde",    label: "🟢 VERDE — Leve / Ambulatorio" },
                { id: "amarillo", label: "🟡 AMARILLO — Moderado / Observación" },
                { id: "rojo",     label: "🔴 ROJO — Grave / Emergencia Inmediata" },
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
              required
              placeholder="Ej: Herida abierta, crisis asmática, sospecha de fractura…"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Alergias o Enfermedades Crónicas">
              <input
                type="text"
                placeholder="Ej: Diabético, Hipertenso, Alergia a Penicilina…"
                className={inputCls}
              />
            </Field>
            <Field label="Tratamiento o Medicación Entregada">
              <input
                type="text"
                placeholder="Medicamentos suministrados en sitio…"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Estatus / Destino del Paciente">
            <select className={inputCls}>
              {DESTINOS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
        </section>

        <button
          type="submit"
          className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3.5 rounded-lg
            shadow-sm transition-colors text-sm tracking-wide"
        >
          💾 GUARDAR REGISTRO MÉDICO
        </button>
      </form>
    </div>
  );
}
