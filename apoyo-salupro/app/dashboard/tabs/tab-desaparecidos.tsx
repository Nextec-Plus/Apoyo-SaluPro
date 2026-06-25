"use client";

import { useState } from "react";

const SECTORES = [
  "Maiquetía", "Caraballeda", "Macuto", "La Guaira",
  "Naiguatá", "Caruao", "Tanaguarena", "Otro",
];

const PAISES = [
  { code: "+1",   label: "🇺🇸 Estados Unidos (+1)" },
  { code: "+34",  label: "🇪🇸 España (+34)" },
  { code: "+57",  label: "🇨🇴 Colombia (+57)" },
  { code: "+51",  label: "🇵🇪 Perú (+51)" },
  { code: "+56",  label: "🇨🇱 Chile (+56)" },
  { code: "+54",  label: "🇦🇷 Argentina (+54)" },
  { code: "+55",  label: "🇧🇷 Brasil (+55)" },
  { code: "+52",  label: "🇲🇽 México (+52)" },
  { code: "+593", label: "🇪🇨 Ecuador (+593)" },
  { code: "+507", label: "🇵🇦 Panamá (+507)" },
  { code: "+1868",label: "🇹🇹 Trinidad y Tobago (+1868)" },
  { code: "+44",  label: "🇬🇧 Reino Unido (+44)" },
  { code: "+39",  label: "🇮🇹 Italia (+39)" },
  { code: "+351", label: "🇵🇹 Portugal (+351)" },
  { code: "+49",  label: "🇩🇪 Alemania (+49)" },
  { code: "+598", label: "🇺🇾 Uruguay (+598)" },
  { code: "+58",  label: "🇻🇪 Venezuela (+58)" },
];

let reportCounter = 104;

function SectionHeader({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
        {number}. {title}
      </h3>
      {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
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

const textareaCls =
  "w-full text-sm bg-white border border-border rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-colors resize-none";

export function TabDesaparecidos() {
  const [submitted, setSubmitted]         = useState(false);
  const [lastCode, setLastCode]           = useState("");
  const [codigoPais, setCodigoPais]       = useState("+1");
  const [telInternacional, setTelIntl]    = useState("");
  const [estado, setEstado]               = useState("Abierto");
  const [mostrarUbicacion, setMostrarUb]  = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = `R-${reportCounter++}`;
    setLastCode(code);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 6000);
    (e.target as HTMLFormElement).reset();
    setCodigoPais("+1");
    setTelIntl("");
    setEstado("Abierto");
    setMostrarUb(false);
  };

  const handleLlamar = () => {
    if (!telInternacional) return;
    const full = `${codigoPais}${telInternacional.replace(/\D/g, "")}`;
    window.open(`tel:${full}`, "_self");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-6">
      <div className="border-b border-border pb-3 mb-6">
        <h2 className="text-lg font-bold text-gray-800">Reporte de Persona Desaparecida</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Datos para equipos de búsqueda y rescate (SAR) · El código se asigna automáticamente.
        </p>
      </div>

      {submitted && (
        <div className="mb-5 bg-primary-light border border-primary/30 text-primary rounded-lg px-4 py-3 text-sm font-semibold">
          ✅ Alerta emitida — Código asignado: <span className="font-bold">{lastCode}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* 1. Informante */}
        <section className="bg-muted rounded-lg border border-border p-4 space-y-4">
          <SectionHeader
            number="1"
            title="Datos de quien Reporta (Informante)"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Su Nombre Completo" required>
              <input type="text" required placeholder="Nombre y apellido" className={inputCls} />
            </Field>
            <Field label="Parentesco con el Desaparecido" required>
              <input
                type="text"
                required
                placeholder="Ej: Madre, Hermano, Vecino…"
                className={inputCls}
              />
            </Field>
            <Field label="Teléfono de Contacto (Venezuela)" required>
              <input type="tel" required placeholder="04XX-XXXXXXX" className={inputCls} />
            </Field>
          </div>
          <Field label="Correo Electrónico / Contacto Alternativo">
            <input type="email" placeholder="correo@ejemplo.com" className={inputCls} />
          </Field>
        </section>

        {/* 2. Desaparecido */}
        <section className="bg-muted rounded-lg border border-border p-4 space-y-4">
          <SectionHeader number="2" title="Datos del Familiar Desaparecido" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Field label="Nombre Completo del Familiar" required>
                <input type="text" required className={inputCls} />
              </Field>
            </div>
            <Field label="Cédula / ID (si aplica)">
              <input type="text" placeholder="V-00000000" className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Edad aprox.">
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
            <Field label="Sector donde residía" required>
              <select required className={inputCls}>
                <option value="">Seleccionar…</option>
                {SECTORES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Edificio / Casa de vivienda">
              <input type="text" placeholder="Residencias El Mar, Torre B…" className={inputCls} />
            </Field>
          </div>
        </section>

        {/* 3. Física / Último avistamiento */}
        <section className="bg-muted rounded-lg border border-border p-4 space-y-4">
          <SectionHeader
            number="3"
            title="Información Física y Último Avistamiento"
          />
          <Field label="Último lugar, fecha y hora donde fue visto" required>
            <input
              type="text"
              required
              placeholder="Ej: En su apartamento en Res. El Mar a las 6:00 AM del 25-Jun…"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Descripción Física (estatura, cabello, cicatrices, tatuajes)">
              <textarea
                rows={3}
                placeholder="Cualquier rasgo distintivo para los rescatistas…"
                className={textareaCls}
              />
            </Field>
            <Field label="Vestimenta al momento de la desaparición">
              <textarea
                rows={3}
                placeholder="Color de camisa, pantalón, calzado si lo recuerda…"
                className={textareaCls}
              />
            </Field>
          </div>
          <Field label="¿Tiene condición médica o discapacidad?">
            <input
              type="text"
              placeholder="Ej: Asmático severo, requiere insulina, hipertenso…"
              className={inputCls}
            />
          </Field>
        </section>

        {/* 4. Contacto Internacional ← clave */}
        <section className="rounded-lg border-2 border-primary/30 bg-primary-light p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📞</span>
            <div>
              <h3 className="text-sm font-bold text-primary">
                Contacto con Familiares en el Exterior
              </h3>
              <p className="text-[11px] text-primary/70">
                Línea habilitada para comunicación directa con familias desde el extranjero.
              </p>
            </div>
          </div>

          {/* Línea de crisis */}
          <div className="bg-white border border-primary/20 rounded-lg px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                Línea de crisis Apoyo SaluPro
              </p>
              <p className="text-xl font-bold text-primary tracking-wider">
                +58 212-000-0000
              </p>
            </div>
            <a
              href="tel:+582120000000"
              className="shrink-0 bg-primary hover:bg-primary-dark text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
            >
              📞 Llamar ahora
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="País de residencia del familiar">
              <select
                value={codigoPais}
                onChange={(e) => setCodigoPais(e.target.value)}
                className={inputCls}
              >
                {PAISES.map((p) => (
                  <option key={p.code} value={p.code}>{p.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Teléfono internacional del familiar">
              <div className="flex gap-2">
                <span className="shrink-0 flex items-center px-3 bg-white border border-border rounded-lg text-sm font-mono font-semibold text-gray-700">
                  {codigoPais}
                </span>
                <input
                  type="tel"
                  value={telInternacional}
                  onChange={(e) => setTelIntl(e.target.value)}
                  placeholder="555 123 4567"
                  className={inputCls}
                />
              </div>
            </Field>
          </div>

          {telInternacional && (
            <button
              type="button"
              onClick={handleLlamar}
              className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg
                transition-colors text-sm tracking-wide"
            >
              📞 LLAMAR AL FAMILIAR AHORA — {codigoPais} {telInternacional}
            </button>
          )}

          <Field label="Notas de la llamada / Mensaje para el familiar">
            <textarea
              rows={2}
              placeholder="Resumen del contacto con el familiar en el exterior…"
              className={textareaCls}
            />
          </Field>
        </section>

        {/* 5. Estado del reporte */}
        <section className="bg-muted rounded-lg border border-border p-4 space-y-4">
          <SectionHeader number="5" title="Estado del Reporte" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Estado actual">
              <select
                value={estado}
                onChange={(e) => {
                  setEstado(e.target.value);
                  setMostrarUb(e.target.value === "Localizado" || e.target.value === "Trasladado");
                }}
                className={inputCls}
              >
                <option>Abierto</option>
                <option>Localizado</option>
                <option>Trasladado</option>
              </select>
            </Field>
            {mostrarUbicacion && (
              <Field label="Ubicación donde fue encontrado">
                <input
                  type="text"
                  placeholder="Ej: Refugio Escuela República de Panamá…"
                  className={inputCls}
                />
              </Field>
            )}
          </div>
        </section>

        <button
          type="submit"
          className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-3.5 rounded-lg
            shadow-sm transition-colors text-sm tracking-wide"
        >
          📢 EMITIR ALERTA DE BÚSQUEDA
        </button>
      </form>
    </div>
  );
}
