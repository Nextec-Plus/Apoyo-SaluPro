"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  type MissingPersonWithImages,
  missingPersonImageUrl,
  STATUS_META,
} from "@/lib/missing-persons";
import type { MissingPersonSearchItem } from "@/lib/search/types";
import type { MissingPersonStatus } from "@/lib/types/database";
import { useToast } from "@/components/toast-provider";
import { isReferidoHospitalNotas, parseDestino } from "@/lib/catastrophe-destinos";

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 leading-snug break-words">{value}</dd>
    </div>
  );
}

/** Acepta tanto el registro completo como el item ligero del search core. */
export type PersonModalPerson = MissingPersonWithImages | MissingPersonSearchItem

export function PersonModal({
  person,
  onClose,
  manage = false,
  publicFound = false,
  onChanged,
}: {
  person: PersonModalPerson;
  onClose: () => void;
  /** Habilita las acciones de gestión (solo vista interna, post-login). */
  manage?: boolean;
  /**
   * Habilita la acción pública (sin login) de marcar como encontrada con una
   * nota opcional. Pensada para las vistas externas (landing, desaparecidos).
   */
  publicFound?: boolean;
  /** Se invoca tras un cambio de estado para refrescar el listado/contadores. */
  onChanged?: () => void;
}) {
  // El estado se mantiene en local para reflejar de inmediato un cambio hecho
  // desde la gestión interna sin esperar al re-fetch del listado. El modal se
  // monta con `key={person.id}` en cada uso, así que este `useState` siempre
  // arranca con el estado correcto de la persona seleccionada.
  const [estado, setEstado] = useState<MissingPersonStatus>(person.estado);

  const m = STATUS_META[estado];
  const esFallecido = estado === "Confirmado Fallecido";
  const images = person.missing_person_images ?? [];
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // ── Gestión interna (cambio de estado) ──────────────────────────────────
  const toast = useToast();
  const [busy, setBusy] = useState<MissingPersonStatus | null>(null);
  const [motivoOpen, setMotivoOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  // Nota opcional que el público puede añadir al marcar como encontrada.
  const [nota, setNota] = useState("");

  async function changeEstado(nuevo: MissingPersonStatus) {
    setBusy(nuevo);
    try {
      const res = await fetch(`/api/missing-persons/${person.id}/sighting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: nuevo,
          ...(nota.trim() ? { notas: nota.trim() } : {}),
          ...(nuevo === "Confirmado Fallecido" && motivo.trim()
            ? { motivo_fallecimiento: motivo.trim() }
            : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "No se pudo actualizar el estado");
      setEstado(nuevo);
      setMotivoOpen(false);
      setMotivo("");
      setNota("");
      toast.success(
        nuevo === "Confirmado Fallecido"
          ? "Persona marcada como fallecida"
          : nuevo === "Encontrado"
            ? "Persona marcada como encontrada"
            : "Reabierta como desaparecida",
      );
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (lightboxIndex !== null) setLightboxIndex(null);
      else onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, lightboxIndex]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="person-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Cerrar"
      />

      <div className="relative w-full sm:max-w-4xl max-h-[92dvh] sm:max-h-none overflow-y-auto sm:overflow-hidden overscroll-contain rounded-t-2xl sm:rounded-2xl bg-card border border-border shadow-2xl grid grid-cols-1 sm:grid-cols-[minmax(220px,34%)_minmax(0,1fr)] items-stretch">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-gray-900/50 hover:bg-gray-900/70 text-white flex items-center justify-center transition-colors"
          aria-label="Cerrar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Imagen */}
        <div className="relative h-[min(36dvh,220px)] sm:aspect-auto sm:h-full sm:min-h-[320px] shrink-0 bg-primary-light border-b sm:border-b-0 sm:border-r border-border">
          {images[0] ? (
            <button
              type="button"
              onClick={() => setLightboxIndex(0)}
              className="absolute inset-0 cursor-zoom-in group"
              aria-label="Ver imagen completa"
            >
              <Image
                src={missingPersonImageUrl(images[0].storage_path)}
                alt={`${person.nombre} ${person.apellido}`}
                fill
                sizes="(max-width: 640px) 100vw, 280px"
                className="object-contain"
              />
              <span className="absolute bottom-3 right-3 rounded-full bg-gray-900/55 text-white text-[10px] font-medium px-2 py-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                Ver completa
              </span>
            </button>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-primary/40">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} className="w-16 h-16">
                <path d="M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>

        {/* Contenido */}
        <div className="p-4 pr-12 sm:p-5 space-y-3 sm:space-y-4">
          <div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${m.chip}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
              {m.label}
            </span>

            <h2 id="person-modal-title" className="mt-2 font-display text-lg sm:text-2xl font-bold tracking-tight leading-tight">
              {person.nombre} {person.apellido}
            </h2>

            {esFallecido
              ? person.motivo_fallecimiento && (
                  <p className="mt-1 text-sm text-gray-600 leading-snug">
                    Motivo de fallecimiento: {person.motivo_fallecimiento}
                  </p>
                )
              : person.ultimo_lugar_visto && (
                  <p className="mt-1 text-sm text-gray-600 leading-snug">
                    {estado === "Encontrado" ? (
                      isReferidoHospitalNotas(person.ultimo_lugar_visto) ? (
                        <>
                          Se encuentra en{" "}
                          <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
                            🏥 {parseDestino(person.ultimo_lugar_visto).hospital || "Hospital"}
                          </span>
                        </>
                      ) : (
                        <>Se encuentra en {person.ultimo_lugar_visto}</>
                      )
                    ) : (
                      <>Visto por última vez en {person.ultimo_lugar_visto}</>
                    )}
                  </p>
                )}

            {esFallecido && person.fallecimiento_confirmado && (
              <p className="mt-1.5 text-xs font-medium text-crisis">
                Estaba reportada como desaparecida; su fallecimiento fue confirmado.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3.5 sm:p-4">
            <h3 className="font-display text-sm font-bold mb-2.5 sm:mb-3">Datos</h3>
            <dl className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 sm:gap-x-5 sm:gap-y-3">
              <Field label="Cédula" value={person.cedula} />
              <Field label="Edad" value={person.edad_aproximada ? `${person.edad_aproximada} años` : null} />
              <Field label="Género" value={person.genero} />
              {esFallecido ? (
                <Field label="Motivo de fallecimiento" value={person.motivo_fallecimiento} />
              ) : (
                <Field
                  label={estado === "Encontrado" ? "Se encuentra en" : "Último lugar"}
                  value={
                    estado === "Encontrado" && isReferidoHospitalNotas(person.ultimo_lugar_visto)
                      ? `🏥 ${parseDestino(person.ultimo_lugar_visto).hospital || "Hospital"}`
                      : person.ultimo_lugar_visto
                  }
                />
              )}
            </dl>
            {person.informacion_adicional && (
              <p className="mt-3 pt-3 text-sm text-gray-700 leading-relaxed border-t border-border">
                {person.informacion_adicional}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary-light/40 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pb-5 sm:pb-4">
            <div className="min-w-0">
              <h3 className="font-display text-sm font-bold">¿Tienes información?</h3>
              <p className="mt-0.5 text-sm text-gray-600 leading-snug">
                Contacta a {person.contacto_nombre} {person.contacto_apellido}.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto shrink-0">
              {person.contacto_telefono_nacional && (
                <a
                  href={`tel:${person.contacto_telefono_nacional}`}
                  className="inline-flex items-center justify-center rounded-lg bg-primary hover:bg-primary-dark text-white font-semibold px-4 py-2.5 sm:py-2 text-sm transition-colors w-full sm:w-auto min-h-[44px] sm:min-h-0"
                >
                  Llamar (nacional)
                </a>
              )}
              {person.contacto_telefono_internacional && (
                <a
                  href={`tel:${person.contacto_telefono_internacional}`}
                  className="inline-flex items-center justify-center rounded-lg bg-primary hover:bg-primary-dark text-white font-semibold px-4 py-2.5 sm:py-2 text-sm transition-colors w-full sm:w-auto min-h-[44px] sm:min-h-0"
                >
                  Llamar (internacional)
                </a>
              )}
              {person.contacto_correo && (
                <a
                  href={`mailto:${person.contacto_correo}`}
                  className="inline-flex items-center justify-center rounded-lg border border-primary/30 text-primary hover:bg-primary-light font-semibold px-4 py-2.5 sm:py-2 text-sm transition-colors w-full sm:w-auto min-h-[44px] sm:min-h-0"
                >
                  Enviar correo
                </a>
              )}
            </div>
          </div>

          {publicFound && estado !== "Encontrado" && estado !== "Confirmado Fallecido" && (
            <div className="rounded-xl border border-primary/25 bg-primary-light/30 p-3.5 sm:p-4">
              <h3 className="font-display text-sm font-bold text-gray-800">¿Ya fue encontrada?</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                Si esta persona ya apareció o fue localizada, ayúdanos a actualizar el
                registro. Puedes añadir una nota si lo deseas.
              </p>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                placeholder="Nota (opcional): dónde o cómo fue encontrada…"
                className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
              />
              <button
                type="button"
                onClick={() => changeEstado("Encontrado")}
                disabled={busy !== null}
                className="mt-3 inline-flex items-center justify-center rounded-lg bg-primary hover:bg-primary-dark text-white font-semibold px-4 py-2.5 text-sm transition-colors disabled:opacity-60 w-full sm:w-auto min-h-[44px] sm:min-h-0"
              >
                {busy === "Encontrado" ? "Guardando…" : "Marcar como encontrada"}
              </button>
            </div>
          )}

          {publicFound && estado === "Encontrado" && (
            <div className="rounded-xl border border-triage-green/30 bg-triage-green/5 p-3.5 sm:p-4 flex items-start gap-2.5">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-triage-green/15 text-triage-green flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                  <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="text-sm text-gray-600 leading-snug">
                Esta persona ya fue marcada como <strong className="text-gray-800">encontrada</strong>. ¡Gracias por mantener el registro al día!
              </p>
            </div>
          )}

          {manage && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 sm:p-4">
              <h3 className="font-display text-sm font-bold text-gray-800">Gestión interna</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                Actualiza el status de esta persona.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {estado !== "Encontrado" && estado !== "Confirmado Fallecido" && (
                  <button
                    type="button"
                    onClick={() => changeEstado("Encontrado")}
                    disabled={busy !== null}
                    className="inline-flex items-center rounded-lg bg-primary hover:bg-primary-dark text-white font-semibold px-3.5 py-2 text-sm transition-colors disabled:opacity-60"
                  >
                    {busy === "Encontrado" ? "Guardando…" : "Marcar como encontrada"}
                  </button>
                )}
                {estado !== "Confirmado Fallecido" && (
                  <button
                    type="button"
                    onClick={() => setMotivoOpen((v) => !v)}
                    disabled={busy !== null}
                    className="inline-flex items-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold px-3.5 py-2 text-sm transition-colors disabled:opacity-60"
                  >
                    Confirmar fallecida
                  </button>
                )}
                {(estado === "Encontrado" || estado === "Confirmado Fallecido") && (
                  <button
                    type="button"
                    onClick={() => changeEstado("Desaparecido")}
                    disabled={busy !== null}
                    className="inline-flex items-center rounded-lg border border-crisis/30 text-crisis hover:bg-crisis-light font-semibold px-3.5 py-2 text-sm transition-colors disabled:opacity-60"
                  >
                    {busy === "Desaparecido" ? "Guardando…" : "Reabrir como desaparecida"}
                  </button>
                )}
              </div>

              {motivoOpen && estado !== "Confirmado Fallecido" && (
                <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-white/70 p-3">
                  <label className="block text-xs font-semibold text-gray-600">
                    Motivo de fallecimiento (opcional)
                  </label>
                  <input
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ej: Causas naturales, accidente…"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
                  />
                  <button
                    type="button"
                    onClick={() => changeEstado("Confirmado Fallecido")}
                    disabled={busy !== null}
                    className="rounded-lg bg-gray-800 hover:bg-gray-900 text-white font-semibold px-3.5 py-2 text-sm transition-colors disabled:opacity-60"
                  >
                    {busy === "Confirmado Fallecido" ? "Confirmando…" : "Confirmar fallecimiento"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {lightboxIndex !== null && images[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-gray-950/95 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Imagen ampliada"
        >
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setLightboxIndex(null)}
            aria-label="Cerrar imagen"
          />
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="relative z-[1] w-full max-w-4xl max-h-[85vh] flex items-center justify-center pointer-events-none">
            <Image
              src={missingPersonImageUrl(images[lightboxIndex].storage_path)}
              alt={`${person.nombre} ${person.apellido}`}
              width={1200}
              height={1600}
              sizes="100vw"
              className="max-w-full max-h-[85vh] w-auto h-auto object-contain"
              priority
            />
          </div>

          {images.length > 1 && (
            <div className="relative z-[1] mt-4 flex gap-2 pointer-events-auto">
              {images.map((img, i) => (
                <button
                  key={(img as { id?: string }).id ?? img.storage_path ?? i}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                    i === lightboxIndex ? "border-white" : "border-white/30 hover:border-white/60"
                  }`}
                  aria-label={`Ver imagen ${i + 1}`}
                >
                  <Image
                    src={missingPersonImageUrl(img.storage_path)}
                    alt=""
                    width={56}
                    height={56}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
