"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast-provider";
import type { InsertMissingPerson } from "@/lib/types/database";
import type { MissingPersonSearchItem } from "@/lib/search/types";
import { missingPersonsConfig } from "@/lib/search/configs";
import { SearchProvider } from "@/components/search/SearchProvider";
import {
  ActiveChips,
  FilterPanel,
  ResultCount,
  ResultsGrid,
  ResultsState,
  SearchBar,
} from "@/components/search/ui";
import {
  MissingPersonCard,
  MissingPersonCardSkeleton,
} from "@/components/search/MissingPersonCard";
import { PersonModal } from "@/app/persona/person-modal";
import type { PersonModalPerson } from "@/app/persona/person-modal";

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

/* ── Tarjetas de estadísticas (datos reales del endpoint /stats) ─────────── */

type Stats = { total: number; busquedas: number; encontradas: number; fallecidas: number };

function StatCards({ stats, loading }: { stats: Stats; loading: boolean }) {
  const cards = [
    { v: stats.total, label: "Personas registradas", color: "text-gray-900", ring: "border-border" },
    { v: stats.busquedas, label: "Aún buscadas", color: "text-crisis", ring: "border-crisis/20" },
    { v: stats.encontradas, label: "Encontradas", color: "text-triage-green", ring: "border-triage-green/25" },
    { v: stats.fallecidas, label: "Fallecidas", color: "text-gray-600", ring: "border-gray-300" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-5">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-xl border bg-white px-3 py-3 sm:px-4 sm:py-3.5 shadow-sm ${c.ring}`}>
          <div className={`font-display text-xl sm:text-3xl font-extrabold tabular-nums ${c.color}`}>
            {loading ? "—" : c.v.toLocaleString("es-VE")}
          </div>
          <div className="mt-0.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-gray-500 leading-tight">
            {c.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Listado de registros (grid de cards, mismo motor que la landing) ────── */

function RegistrosList({ reloadToken }: { reloadToken: number }) {
  const [selected, setSelected] = useState<PersonModalPerson | null>(null);
  return (
    // key fuerza un re-fetch limpio cuando se emite un nuevo reporte.
    <SearchProvider key={reloadToken} config={missingPersonsConfig}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-sm">
          <SearchBar placeholder="Buscar por nombre, apellido o cédula…" accent="primary" />
        </div>
        <div className="flex items-end gap-3">
          <FilterPanel layout="inline" />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <ActiveChips />
        <ResultCount
          loadingLabel="Cargando…"
          formatter={(c) => `${c} resultado${c !== 1 ? "s" : ""}`}
        />
      </div>

      <div className="mt-4">
        <ResultsGrid
          columns="sm:grid-cols-2 lg:grid-cols-3"
          skeleton={<MissingPersonCardSkeleton imageHeight="h-[180px]" />}
          skeletonCount={6}
          renderItem={(p: MissingPersonSearchItem) => (
            <MissingPersonCard
              key={p.id}
              p={p}
              onOpen={setSelected}
              accent="primary"
              imageHeight="h-[200px]"
            />
          )}
        />
        <ResultsState emptyTitle="Ningún registro coincide con tu búsqueda." />
      </div>

      {selected && <PersonModal person={selected} onClose={() => setSelected(null)} />}
    </SearchProvider>
  );
}

type RegistroTipo = "desaparecida" | "fallecida";

export function TabDesaparecidos() {
  const toast = useToast();
  const [view, setView] = useState<"reportar" | "registros">("reportar");
  const [tipo, setTipo] = useState<RegistroTipo>("desaparecida");
  const [reloadToken, setReloadToken] = useState(0);

  /* ── Estadísticas globales ─────────────────────────────────────────── */
  const [stats, setStats] = useState<Stats>({ total: 0, busquedas: 0, encontradas: 0, fallecidas: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/missing-persons/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (active && !json.error) setStats(json);
      })
      .catch(() => {
        /* silencioso: las tarjetas muestran el último valor conocido */
      })
      .finally(() => active && setStatsLoading(false));
    return () => {
      active = false;
    };
  }, [reloadToken]);

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
    setTipo("desaparecida");
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

    const esFallecida = tipo === "fallecida";

    const nombre = (fd.get("nombre") as string)?.trim();
    const apellido = (fd.get("apellido") as string)?.trim();
    if (!nombre || !apellido) {
      const msg = esFallecida
        ? "El nombre y el apellido de la persona fallecida son obligatorios."
        : "El nombre y el apellido de la persona desaparecida son obligatorios.";
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
      // Según el tipo: lugar visto (desaparecida) o motivo (fallecida, opcional).
      ultimo_lugar_visto: esFallecida ? null : str("ultimo_lugar_visto"),
      motivo_fallecimiento: esFallecida ? str("motivo_fallecimiento") : null,
      estado: esFallecida ? "Confirmado Fallecido" : "Desaparecido",
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
      if (!res.ok || json.error)
        throw new Error(
          json.error || (esFallecida ? "No se pudo registrar el fallecimiento" : "No se pudo emitir la alerta"),
        );

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

      // El backend avisa si la cédula ya estaba reportada como desaparecida:
      // en ese caso se actualizó ese mismo registro a "Confirmado Fallecido".
      const matched = json.matched_missing as { nombre: string; apellido: string } | null;
      if (matched) {
        toast.success(
          `⚠️ ${matched.nombre} ${matched.apellido} estaba reportada como DESAPARECIDA. Su registro se actualizó a fallecida.`,
        );
      } else if (esFallecida) {
        toast.success("Fallecimiento registrado correctamente.");
      } else {
        toast.success("Alerta emitida — el reporte quedó registrado.");
      }
      resetForm();
      setReloadToken((t) => t + 1); // refresca stats + listado
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
            Registros {!statsLoading ? `(${stats.total.toLocaleString("es-VE")})` : ""}
          </button>
        </div>
      </div>

      {view === "reportar" ? (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          {/* Tipo de registro: desaparecida o fallecida (solo interno) */}
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            {([
              { v: "desaparecida", label: "Persona desaparecida" },
              { v: "fallecida", label: "Persona fallecida" },
            ] as const).map((opt) => {
              const active = tipo === opt.v;
              const accent =
                opt.v === "fallecida" ? "text-gray-800" : "text-primary";
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setTipo(opt.v)}
                  aria-pressed={active}
                  className={`text-sm font-semibold px-3.5 py-2 rounded-md transition-colors ${
                    active ? `bg-white shadow-sm ${accent}` : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* 1. Datos de la persona */}
          <section className="bg-muted rounded-lg border border-border p-4 space-y-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              {tipo === "fallecida"
                ? "1. Datos de la persona fallecida"
                : "1. Datos de la persona desaparecida"}
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

            {tipo === "fallecida" ? (
              <Field label="Motivo de fallecimiento (opcional)">
                <input
                  name="motivo_fallecimiento"
                  placeholder="Ej: Causas naturales, accidente…"
                  className={inputCls}
                />
              </Field>
            ) : (
              <Field label="Último lugar visto">
                <input name="ultimo_lugar_visto" placeholder="Ej: Macuto, cerca del malecón" className={inputCls} />
              </Field>
            )}
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
            {submitting
              ? tipo === "fallecida"
                ? "REGISTRANDO…"
                : "EMITIENDO…"
              : tipo === "fallecida"
                ? "REGISTRAR FALLECIMIENTO"
                : "EMITIR ALERTA DE BÚSQUEDA"}
          </button>
        </form>
      ) : (
        <div>
          <StatCards stats={stats} loading={statsLoading} />
          <RegistrosList reloadToken={reloadToken} />
        </div>
      )}
    </div>
  );
}
