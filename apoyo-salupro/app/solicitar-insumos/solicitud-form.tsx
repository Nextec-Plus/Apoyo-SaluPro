"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SolicitorType } from "@/lib/types/database";
import type { SectionWithSubcats } from "./page";

/* ── Estilos reutilizables ──────────────────────────────────────────────── */
const inputCls =
  "w-full rounded-xl border border-border px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-colors bg-white";
const labelCls = "block text-sm font-semibold text-gray-700 mb-1.5";

/* ── Iconos por sección ─────────────────────────────────────────────────── */
const SECTION_ICONS: Record<string, string> = {
  "1": "💊", "2": "🧪", "3": "🤧", "4": "💧",
  "5": "🌿", "6": "🩺", "7": "🧴", "8": "🏥",
  "9": "🏗️", "10": "👕", "11": "🍽️", "12": "🧼",
};

/* ── Tipos de solicitante ────────────────────────────────────────────────── */
const TIPOS: { value: SolicitorType; label: string; icon: string; desc: string }[] = [
  { value: "Persona", label: "Persona", icon: "🧑", desc: "Ciudadano o familiar" },
  { value: "Clínica / Hospital", label: "Clínica / Hospital", icon: "🏥", desc: "Centro médico" },
  { value: "Centro de acopio", label: "Centro de acopio", icon: "📦", desc: "Punto de distribución" },
];

/* ── Tipos internos ─────────────────────────────────────────────────────── */
type SelSubcat = { id: string; name: string; code: string };
type SelectedSection = {
  id: string;
  name: string;
  code: string;
  selectedSubcats: SelSubcat[];
};

type GpsState = "idle" | "loading" | "success" | "error";

/* ── Icon SVG ────────────────────────────────────────────────────────────── */
function Icon({ path, className = "" }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={path} />
    </svg>
  );
}

const I = {
  gps:     "M12 2a7 7 0 0 1 7 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 0 1 7-7zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  check:   "M20 6 9 17l-5-5",
  warning: "M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  spinner: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83",
  back:    "M19 12H5M12 5l-7 7 7 7",
  chevron: "M9 18l6-6-6-6",
};

/* ── Props ───────────────────────────────────────────────────────────────── */
interface Props {
  sections: SectionWithSubcats[];
}

export function SolicitudForm({ sections }: Props) {
  const router = useRouter();

  const [tipo, setTipo] = useState<SolicitorType>("Persona");
  const [selected, setSelected] = useState<SelectedSection[]>([]);
  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [gpsAddress, setGpsAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  /* ── GPS ─────────────────────────────────────────────────────────────── */
  const handleGetLocation = () => {
    if (!navigator.geolocation) { setGpsState("error"); return; }
    setGpsState("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
        setCoords({ lat, lng });
        setAccuracy(acc ?? null);
        setGpsState("success");
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { "Accept-Language": "es" } },
          );
          const j = await r.json();
          if (j.display_name) setGpsAddress(j.display_name);
        } catch { /* optional */ }
      },
      () => setGpsState("error"),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  /* ── Toggle sección ──────────────────────────────────────────────────── */
  const toggleSection = (s: SectionWithSubcats) => {
    setSelected((prev) =>
      prev.some((x) => x.id === s.id)
        ? prev.filter((x) => x.id !== s.id)
        : [...prev, { id: s.id, name: s.name, code: s.code, selectedSubcats: [] }],
    );
  };

  /* ── Toggle subcategoría ─────────────────────────────────────────────── */
  const toggleSubcat = (sectionId: string, sub: SelSubcat) => {
    setSelected((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        const has = sec.selectedSubcats.some((x) => x.id === sub.id);
        return {
          ...sec,
          selectedSubcats: has
            ? sec.selectedSubcats.filter((x) => x.id !== sub.id)
            : [...sec.selectedSubcats, sub],
        };
      }),
    );
  };

  /* ── Submit ──────────────────────────────────────────────────────────── */
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (selected.length === 0) { setError("Selecciona al menos una categoría de insumos."); return; }
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const str = (k: string) => (fd.get(k) as string)?.trim() || null;

    const body = {
      nombre: str("nombre") ?? "",
      cedula_rif: str("cedula_rif"),
      telefono: str("telefono") ?? "",
      correo: str("correo"),
      tipo_solicitante: tipo,
      latitud: coords?.lat ?? null,
      longitud: coords?.lng ?? null,
      direccion: str("direccion"),
      secciones_solicitadas: selected,
      notas: str("notas"),
    };

    try {
      const res = await fetch("/api/supply-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Error al enviar la solicitud.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Pantalla de éxito ───────────────────────────────────────────────── */
  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-light/40 to-muted flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-border p-8 sm:p-10 text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary-light text-primary flex items-center justify-center mx-auto mb-6">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold mb-3 text-gray-900">¡Solicitud recibida!</h1>
          <p className="text-sm text-gray-600 leading-relaxed mb-2">
            Registramos tu solicitud. El equipo la revisará y te contactará por el teléfono indicado.
          </p>
          <p className="text-xs text-gray-400 mb-8">Tiempo de respuesta estimado: 24–48 horas.</p>
          <div className="flex flex-col gap-3">
            <Link href="/" className="rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition-colors">
              Volver al inicio
            </Link>
            <button
              type="button"
              onClick={() => { setDone(false); setSelected([]); setCoords(null); setAccuracy(null); setGpsState("idle"); setGpsAddress(""); }}
              className="rounded-xl border border-border hover:bg-muted text-gray-600 font-semibold py-3 text-sm transition-colors"
            >
              Hacer otra solicitud
            </button>
          </div>
        </div>
      </div>
    );
  }

  const esOrganizacion = tipo !== "Persona";
  const nombreLabel = esOrganizacion ? `Nombre de la ${tipo === "Clínica / Hospital" ? "clínica / hospital" : "organización"}` : "Nombre completo";
  const cedulaLabel = esOrganizacion ? "RIF" : "Cédula de identidad";

  return (
    <div className="min-h-screen bg-muted">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-border shadow-sm">
        <div className="mx-auto max-w-3xl px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center shrink-0">
            <Image src="/logo_salupro_light.png" alt="SaluPro" width={140} height={42} priority className="h-8 w-auto" />
          </Link>
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">
            <Icon path={I.back} className="w-4 h-4" />
            <span className="hidden sm:inline">Volver</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 pb-16">
        <div className="mb-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-light text-primary-dark text-xs font-semibold px-3 py-1.5 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Ayuda humanitaria · Venezuela
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Solicitar insumos
          </h1>
          <p className="mt-2 text-gray-600 text-sm sm:text-base leading-relaxed max-w-xl">
            Completa el formulario y el equipo de Apoyo SaluPro coordinará la entrega
            según disponibilidad. Sin costo.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">

          {/* ── 1. Tipo de solicitante ───────────────────────────── */}
          <fieldset className="rounded-2xl border border-border bg-white p-6 sm:p-7">
            <legend className="px-2 font-display text-lg font-bold text-gray-900">¿Quién solicita?</legend>
            <p className="text-xs text-gray-500 mb-4 mt-1">Selecciona la categoría que mejor te describe.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TIPOS.map((t) => {
                const active = tipo === t.value;
                return (
                  <button key={t.value} type="button" onClick={() => setTipo(t.value)}
                    className={["flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-all",
                      active ? "border-primary bg-primary-light text-primary-dark shadow-sm"
                             : "border-border bg-white text-gray-600 hover:border-primary/40 hover:bg-primary-light/30",
                    ].join(" ")}>
                    <span className="text-2xl">{t.icon}</span>
                    <span className="font-semibold text-center leading-snug">{t.label}</span>
                    <span className="text-[11px] text-gray-400 text-center">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* ── 2. Identidad ────────────────────────────────────── */}
          <fieldset className="rounded-2xl border border-border bg-white p-6 sm:p-7">
            <legend className="px-2 font-display text-lg font-bold text-gray-900">Tus datos</legend>
            <p className="text-xs text-gray-500 mb-5 mt-1">Solo usamos esta información para coordinar la entrega.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="nombre" className={labelCls}>
                  {nombreLabel} <span className="text-crisis">*</span>
                </label>
                <input id="nombre" name="nombre" required autoComplete="name" className={inputCls}
                  placeholder={esOrganizacion ? "Ej. Hospital Central La Guaira" : "Ej. María Fernández"} />
              </div>
              <div>
                <label htmlFor="cedula_rif" className={labelCls}>{cedulaLabel}</label>
                <input id="cedula_rif" name="cedula_rif" className={inputCls}
                  placeholder={esOrganizacion ? "J-12345678-9" : "V-12345678"} />
              </div>
              <div>
                <label htmlFor="telefono" className={labelCls}>Teléfono <span className="text-crisis">*</span></label>
                <input id="telefono" name="telefono" required inputMode="tel" autoComplete="tel" className={inputCls} placeholder="0412-1234567" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="correo" className={labelCls}>
                  Correo electrónico{" "}
                  <span className="text-xs font-normal text-gray-400">(opcional)</span>
                </label>
                <input id="correo" name="correo" type="email" autoComplete="email" className={inputCls} placeholder="tucorreo@ejemplo.com" />
              </div>
            </div>
          </fieldset>

          {/* ── 3. Categorías + Subcategorías ───────────────────── */}
          <fieldset className="rounded-2xl border border-border bg-white p-6 sm:p-7">
            <legend className="px-2 font-display text-lg font-bold text-gray-900">¿Qué necesitas?</legend>
            <p className="text-xs text-gray-500 mb-5 mt-1">
              Selecciona una o más categorías. Al elegirla podrás especificar exactamente qué tipo necesitas.
            </p>

            {/* Grid de secciones */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {sections.map((s) => {
                const active = selected.some((x) => x.id === s.id);
                return (
                  <button key={s.id} type="button" onClick={() => toggleSection(s)}
                    className={["relative flex flex-col items-center gap-2 rounded-xl border-2 p-3.5 text-center transition-all",
                      active ? "border-primary bg-primary-light shadow-sm"
                             : "border-border bg-white hover:border-primary/40 hover:bg-primary-light/20",
                    ].join(" ")}>
                    {active && (
                      <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Icon path={I.check} className="w-2.5 h-2.5 text-white" />
                      </span>
                    )}
                    <span className="text-2xl leading-none">{SECTION_ICONS[s.code] ?? "📋"}</span>
                    <span className={["text-xs font-semibold leading-snug",
                      active ? "text-primary-dark" : "text-gray-700"].join(" ")}>
                      {s.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Subcategorías por sección seleccionada */}
            {selected.length > 0 && (
              <div className="mt-5 space-y-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Especifica qué necesitas de cada categoría
                </p>
                {selected.map((sec) => {
                  const full = sections.find((s) => s.id === sec.id);
                  if (!full || full.subcategories.length === 0) return null;
                  return (
                    <div key={sec.id} className="rounded-xl border border-primary/20 bg-primary-light/20 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">{SECTION_ICONS[sec.code] ?? "📋"}</span>
                        <span className="text-sm font-bold text-primary-dark">{sec.name}</span>
                        {sec.selectedSubcats.length === 0 && (
                          <span className="ml-auto text-[11px] text-gray-400 italic">
                            Todas (o especifica abajo)
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {full.subcategories.map((sub) => {
                          const active = sec.selectedSubcats.some((x) => x.id === sub.id);
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => toggleSubcat(sec.id, { id: sub.id, name: sub.name, code: sub.code })}
                              title={sub.description ?? undefined}
                              className={["inline-flex flex-col rounded-xl border-2 px-3 py-2 text-left transition-all",
                                active
                                  ? "border-primary bg-primary text-white shadow-sm"
                                  : "border-border bg-white text-gray-700 hover:border-primary/50 hover:bg-primary-light/40",
                              ].join(" ")}
                            >
                              <span className="text-xs font-semibold leading-snug">{sub.name}</span>
                              {sub.description && (
                                <span className={["text-[11px] leading-tight mt-0.5",
                                  active ? "text-white/75" : "text-gray-400"].join(" ")}>
                                  {sub.description}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Resumen seleccionado */}
            {selected.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-gray-400 mb-2 font-medium">Resumen de tu selección:</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.map((sec) => (
                    <span key={sec.id} className="inline-flex items-center gap-1.5 rounded-full bg-primary-light text-primary-dark text-xs font-semibold px-3 py-1">
                      {SECTION_ICONS[sec.code] ?? "📋"} {sec.name}
                      {sec.selectedSubcats.length > 0 && (
                        <span className="text-primary/60">· {sec.selectedSubcats.length} tipo{sec.selectedSubcats.length !== 1 ? "s" : ""}</span>
                      )}
                      <button type="button" onClick={() => setSelected((p) => p.filter((x) => x.id !== sec.id))}
                        className="ml-0.5 hover:text-crisis" aria-label={`Quitar ${sec.name}`}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </fieldset>

          {/* ── 4. Ubicación ────────────────────────────────────── */}
          <fieldset className="rounded-2xl border border-border bg-white p-6 sm:p-7">
            <legend className="px-2 font-display text-lg font-bold text-gray-900">¿Dónde estás?</legend>
            <p className="text-xs text-gray-500 mb-4 mt-1">
              Tu ubicación nos ayuda a coordinar la entrega. Compártela automáticamente o descríbela.
            </p>

            {/* Llamado a usar ubicación exacta (recomendado, no obligatorio) */}
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-light/40 px-4 py-3">
              <span className="text-lg leading-none mt-0.5">📍</span>
              <p className="text-xs text-primary-dark leading-relaxed">
                <strong>Lo ideal es compartir tu ubicación exacta.</strong> No es obligatorio, pero ayuda a que la ayuda
                llegue más rápido y al lugar correcto. Tu punto se suma al mapa de calor que prioriza las zonas más afectadas.
              </p>
            </div>

            <div className="mb-4">
              {gpsState === "idle" && (
                <button type="button" onClick={handleGetLocation}
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-dark px-5 py-3.5 text-sm font-bold text-white transition-colors w-full shadow-sm shadow-primary/20">
                  <Icon path={I.gps} className="w-5 h-5" />
                  Usar mi ubicación exacta (recomendado)
                </button>
              )}
              {gpsState === "loading" && (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted px-5 py-3.5 text-sm text-gray-500">
                  <Icon path={I.spinner} className="w-5 h-5 animate-spin text-primary" />
                  Obteniendo ubicación…
                </div>
              )}
              {gpsState === "success" && coords && (
                <div className="rounded-xl border border-primary/30 bg-primary-light/40 px-5 py-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon path={I.gps} className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-primary-dark">Ubicación detectada</span>
                  </div>
                  {gpsAddress && <p className="text-xs text-gray-600 mb-1 leading-relaxed">{gpsAddress}</p>}
                  <p className="text-[11px] font-mono text-gray-400">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>
                  {accuracy !== null && (
                    <p className={`text-[11px] font-semibold mt-1 ${accuracy <= 30 ? "text-primary" : accuracy <= 100 ? "text-amber-600" : "text-gray-400"}`}>
                      Precisión: ±{Math.round(accuracy)} m
                      {accuracy <= 30 ? " · excelente" : accuracy <= 100 ? " · buena" : " · aproximada (activa el GPS para mejorarla)"}
                    </p>
                  )}
                  <button type="button" onClick={() => { setGpsState("idle"); setCoords(null); setAccuracy(null); setGpsAddress(""); }}
                    className="mt-2 text-xs text-gray-400 hover:text-crisis underline underline-offset-2">
                    Eliminar ubicación
                  </button>
                </div>
              )}
              {gpsState === "error" && (
                <div className="flex items-center gap-2 rounded-xl border border-crisis/30 bg-crisis-light/40 px-5 py-3.5 text-sm text-crisis">
                  <Icon path={I.warning} className="w-4 h-4 shrink-0" />
                  No se pudo obtener la ubicación. Descríbela manualmente.
                </div>
              )}
            </div>

            <div>
              <label htmlFor="direccion" className={labelCls}>
                Descripción de tu ubicación{" "}
                {gpsState !== "success" && <span className="text-crisis">*</span>}
              </label>
              <textarea id="direccion" name="direccion" rows={3} required={gpsState !== "success"} className={inputCls}
                placeholder="Ej. Sector El Tanque, Callejón Los Mangos, frente a la escuela primaria, La Guaira" />
              <p className="mt-1.5 text-xs text-gray-400">Sé lo más específico posible: sector, calle, punto de referencia.</p>
            </div>
          </fieldset>

          {/* ── 5. Notas ────────────────────────────────────────── */}
          <fieldset className="rounded-2xl border border-border bg-white p-6 sm:p-7">
            <legend className="px-2 font-display text-lg font-bold text-gray-900">Notas adicionales</legend>
            <p className="text-xs text-gray-500 mb-4 mt-1">
              Aquí puedes explayarte: productos específicos, marcas, cantidades, urgencia, condiciones especiales…
            </p>
            <textarea id="notas" name="notas" rows={5} className={inputCls}
              placeholder={tipo === "Persona"
                ? "Ej. Necesito pañales talla 2 para mi bebé de 6 meses, también suero oral. Somos 3 personas, una adulta mayor diabética."
                : "Ej. Necesitamos antibióticos pediátricos y material de cura urgente para 40 pacientes por semana. Tenemos refrigeración."} />
          </fieldset>

          {/* ── Error ───────────────────────────────────────────── */}
          {error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-crisis/30 bg-crisis-light px-5 py-4 text-sm text-crisis">
              <Icon path={I.warning} className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <p className="text-xs text-gray-400 text-center px-4">
            Al enviar aceptas que Apoyo SaluPro use tus datos de contacto y ubicación
            exclusivamente para coordinar la entrega de insumos.
          </p>

          {/* ── Botones ─────────────────────────────────────────── */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Link href="/" className="text-center rounded-xl border border-border hover:bg-muted text-gray-700 font-semibold px-6 py-3.5 text-sm transition-colors">
              Cancelar
            </Link>
            <button type="submit" disabled={loading}
              className="rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold px-10 py-3.5 text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-primary/20">
              {loading ? "Enviando…" : "Enviar solicitud"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
