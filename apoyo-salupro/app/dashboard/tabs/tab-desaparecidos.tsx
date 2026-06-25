"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useToast } from "@/components/toast-provider";
import {
  type MissingPersonWithImages,
  firstImageUrl,
  STATUS_META,
} from "@/lib/missing-persons";
import type { InsertMissingPerson } from "@/lib/types/database";
import { PersonModal } from "@/app/persona/person-modal";

const inputCls =
  "w-full text-sm bg-white border border-border rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-colors";
const textareaCls = inputCls + " resize-none";
const labelCls = "block text-xs font-semibold text-gray-700 mb-1";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>
        {label}
        {required && <span className="text-crisis ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function PersonIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    </svg>
  );
}

export function TabDesaparecidos() {
  const toast = useToast();
  const [view, setView] = useState<"reportar" | "registros">("reportar");

  /* ── Listado de registros ──────────────────────────────────────────── */
  const [persons, setPersons] = useState<MissingPersonWithImages[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<MissingPersonWithImages | null>(null);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setListError(false);
    try {
      const res = await fetch("/api/missing-persons");
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Error al cargar");
      setPersons((json.data ?? []) as MissingPersonWithImages[]);
    } catch {
      setListError(true);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return persons;
    return persons.filter(
      (p) =>
        `${p.nombre} ${p.apellido}`.toLowerCase().includes(term) ||
        (p.cedula ?? "").toLowerCase().includes(term),
    );
  }, [persons, q]);

  /* ── Formulario ────────────────────────────────────────────────────── */
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const resetForm = () => {
    formRef.current?.reset();
    setPreview(null);
    setFormError("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const str = (k: string) => {
      const v = (fd.get(k) as string)?.trim();
      return v || null;
    };
    const num = (k: string) => {
      const v = fd.get(k);
      return v ? Number(v) : null;
    };

    const nombre = (fd.get("nombre") as string)?.trim();
    const apellido = (fd.get("apellido") as string)?.trim();
    if (!nombre || !apellido) {
      const msg = "El nombre y el apellido de la persona desaparecida son obligatorios.";
      setFormError(msg);
      toast.error(msg);
      setSubmitting(false);
      return;
    }

    const body: InsertMissingPerson = {
      nombre,
      apellido,
      cedula: str("cedula"),
      edad_aproximada: num("edad_aproximada"),
      genero: str("genero"),
      ultimo_lugar_visto: str("ultimo_lugar_visto"),
      informacion_adicional: str("informacion_adicional"),
      // Contacto (familiar) — todos opcionales. Un único nombre y teléfono.
      contacto_nombre: str("contacto_nombre") ?? "",
      contacto_apellido: "",
      contacto_correo: str("contacto_correo"),
      contacto_telefono_nacional: str("contacto_telefono"),
      contacto_telefono_internacional: null,
    };

    try {
      const res = await fetch("/api/missing-persons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "No se pudo emitir la alerta");

      const id: string = json.data.id;

      // Foto opcional: si falla, el reporte ya quedó creado.
      const file = fileRef.current?.files?.[0];
      if (file) {
        const imgForm = new FormData();
        imgForm.append("file", file);
        const imgRes = await fetch(`/api/missing-persons/${id}/images`, {
          method: "POST",
          body: imgForm,
        });
        if (!imgRes.ok) {
          const ij = await imgRes.json().catch(() => null);
          toast.error("El reporte se guardó, pero la foto no se pudo subir.");
          console.warn("No se pudo subir la foto:", ij?.error);
        }
      }

      toast.success("Alerta emitida — el reporte quedó registrado.");
      resetForm();
      await loadList();
      setView("registros");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Render ────────────────────────────────────────────────────────── */
  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-6">
      <div className="border-b border-border pb-3 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Personas Desaparecidas</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Registro de reportes para equipos de búsqueda y rescate.
          </p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button
            type="button"
            onClick={() => setView("reportar")}
            className={`text-sm font-semibold px-3.5 py-1.5 rounded-md transition-colors ${
              view === "reportar" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Nuevo reporte
          </button>
          <button
            type="button"
            onClick={() => setView("registros")}
            className={`text-sm font-semibold px-3.5 py-1.5 rounded-md transition-colors ${
              view === "registros" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Registros {!loadingList && !listError ? `(${persons.length})` : ""}
          </button>
        </div>
      </div>

      {view === "reportar" ? (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Persona desaparecida */}
          <section className="bg-muted rounded-lg border border-border p-4 space-y-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              1. Datos de la persona desaparecida
            </h3>

            <div className="flex flex-col sm:flex-row gap-5">
              {/* Foto */}
              <div className="shrink-0">
                <span className={labelCls}>Foto (opcional)</span>
                <label className="block w-32 h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-white cursor-pointer overflow-hidden relative transition-colors">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="Vista previa" className="w-full h-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 text-xs gap-1">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                      </svg>
                      Subir foto
                    </span>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" onChange={onPickPhoto} className="sr-only" />
                </label>
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nombre" required>
                  <input name="nombre" required placeholder="Ej: María" className={inputCls} />
                </Field>
                <Field label="Apellido" required>
                  <input name="apellido" required placeholder="Ej: Fernández" className={inputCls} />
                </Field>
                <Field label="Cédula / ID">
                  <input name="cedula" placeholder="V-00000000" className={inputCls} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Edad aprox.">
                    <input name="edad_aproximada" type="number" min={0} max={130} className={inputCls} />
                  </Field>
                  <Field label="Género">
                    <select name="genero" defaultValue="" className={inputCls}>
                      <option value="">—</option>
                      <option value="M">M</option>
                      <option value="F">F</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </Field>
                </div>
              </div>
            </div>

            <Field label="Último lugar visto">
              <input name="ultimo_lugar_visto" placeholder="Ej: Macuto, cerca del malecón" className={inputCls} />
            </Field>
            <Field label="Información adicional">
              <textarea
                name="informacion_adicional"
                rows={3}
                placeholder="Vestimenta, señas particulares, condición médica…"
                className={textareaCls}
              />
            </Field>
          </section>

          {/* 2. Familiar / contacto — todos opcionales */}
          <section className="bg-muted rounded-lg border border-border p-4 space-y-4">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                2. Familiar de contacto
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Opcional. A quién contactar si alguien tiene información.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Nombre del familiar">
                <input name="contacto_nombre" placeholder="Nombre y apellido" className={inputCls} />
              </Field>
              <Field label="Teléfono">
                <input name="contacto_telefono" type="tel" placeholder="0412-1234567" className={inputCls} />
              </Field>
              <Field label="Correo electrónico">
                <input name="contacto_correo" type="email" placeholder="correo@ejemplo.com" className={inputCls} />
              </Field>
            </div>
          </section>

          {formError && (
            <p className="text-sm text-crisis bg-crisis-light border border-crisis/20 rounded-lg px-4 py-3">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-3.5 rounded-lg shadow-sm transition-colors text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "EMITIENDO…" : "EMITIR ALERTA DE BÚSQUEDA"}
          </button>
        </form>
      ) : (
        <div>
          <div className="relative mb-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2">
              <path d="m21 21-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, apellido o cédula…"
              className="w-full rounded-lg border border-border bg-muted/60 pl-11 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-colors"
            />
          </div>

          {loadingList ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-muted/50 animate-pulse h-[110px]" />
              ))}
            </div>
          ) : listError ? (
            <div className="text-center py-12">
              <p className="text-sm text-crisis bg-crisis-light border border-crisis/20 rounded-lg px-4 py-3 inline-block">
                No se pudieron cargar los registros.
              </p>
              <div>
                <button onClick={loadList} className="mt-4 text-sm font-semibold text-primary hover:text-primary-dark">
                  Reintentar
                </button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-dashed border-border">
              <PersonIcon className="w-10 h-10 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm font-medium">
                {persons.length === 0
                  ? "Aún no hay reportes registrados."
                  : "Ningún registro coincide con tu búsqueda."}
              </p>
              {persons.length === 0 && (
                <button
                  onClick={() => setView("reportar")}
                  className="mt-4 text-sm font-semibold text-primary hover:text-primary-dark"
                >
                  Crear el primer reporte
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((p) => {
                const img = firstImageUrl(p);
                const m = STATUS_META[p.estado];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p)}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-white p-3 text-left hover:border-primary/40 hover:shadow-md transition-all"
                  >
                    <div className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-primary-light">
                      {img ? (
                        <Image src={img} alt={`${p.nombre} ${p.apellido}`} fill sizes="64px" className="object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-primary/40">
                          <PersonIcon className="w-7 h-7" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm text-gray-900 truncate">
                        {p.nombre} {p.apellido}
                      </h3>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {[p.edad_aproximada ? `${p.edad_aproximada} años` : null, p.ultimo_lugar_visto]
                          .filter(Boolean)
                          .join(" · ") || "Sin detalles"}
                      </p>
                      <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.chip}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                        {m.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selected && <PersonModal person={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
