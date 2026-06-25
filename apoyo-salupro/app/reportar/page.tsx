"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";
import type { InsertMissingPerson } from "@/lib/types/database";

const inputCls =
  "w-full rounded-lg border border-border px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-colors";
const labelCls = "block text-sm font-semibold text-gray-700 mb-1.5";

export default function ReportarPage() {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [doneId, setDoneId] = useState<string | null>(null);

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const num = (k: string) => {
      const v = fd.get(k);
      return v ? Number(v) : null;
    };
    const str = (k: string) => {
      const v = (fd.get(k) as string)?.trim();
      return v || null;
    };

    const body: InsertMissingPerson = {
      nombre: (fd.get("nombre") as string).trim(),
      apellido: (fd.get("apellido") as string).trim(),
      cedula: str("cedula"),
      edad_aproximada: num("edad_aproximada"),
      genero: str("genero"),
      ultimo_lugar_visto: str("ultimo_lugar_visto"),
      informacion_adicional: str("informacion_adicional"),
      contacto_nombre: (fd.get("contacto_nombre") as string).trim(),
      contacto_apellido: (fd.get("contacto_apellido") as string).trim(),
      contacto_correo: str("contacto_correo"),
      contacto_telefono_nacional: str("contacto_telefono_nacional"),
      contacto_telefono_internacional: str("contacto_telefono_internacional"),
    };

    if (!body.contacto_telefono_nacional && !body.contacto_telefono_internacional) {
      toast.error("Indica al menos un teléfono de contacto (nacional o internacional).");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/missing-persons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Error al crear el reporte");

      const id: string = json.data.id;

      // Subir foto (opcional)
      const file = fileRef.current?.files?.[0];
      if (file) {
        const imgForm = new FormData();
        imgForm.append("file", file);
        const imgRes = await fetch(`/api/missing-persons/${id}/images`, {
          method: "POST",
          body: imgForm,
        });
        // La foto es complementaria: si falla, el reporte ya quedó creado.
        if (!imgRes.ok) {
          const ij = await imgRes.json().catch(() => null);
          console.warn("No se pudo subir la foto:", ij?.error);
        }
      }

      setDoneId(id);
      toast.success("Reporte registrado correctamente");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ── Pantalla de éxito ─────────────────────────────────────────────── */
  if (doneId) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-card rounded-2xl shadow-lg border border-border p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-light text-primary flex items-center justify-center mx-auto mb-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold mb-2">Reporte registrado</h1>
          <p className="text-sm text-gray-600 mb-6">
            El reporte ya forma parte del registro central público. Cualquier persona con
            información podrá contactarte.
          </p>
          <div className="flex flex-col gap-2.5">
            <Link href={`/persona/${doneId}`} className="rounded-lg bg-primary hover:bg-primary-dark text-white font-semibold py-3 text-sm transition-colors">
              Ver el reporte
            </Link>
            <Link href="/" className="rounded-lg border border-border hover:bg-muted text-gray-700 font-semibold py-3 text-sm transition-colors">
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-3xl px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image src="/logo_salupro_light.png" alt="SaluPro" width={140} height={42} priority className="h-8 w-auto" />
          </Link>
          <button onClick={() => router.back()} className="text-sm font-medium text-gray-500 hover:text-gray-800">
            ← Volver
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
            Reportar persona desaparecida
          </h1>
          <p className="mt-2 text-gray-600">
            Estos datos serán públicos para ayudar a localizar a la persona. Completa todo lo
            que sepas; solo el nombre, apellido y un contacto son obligatorios.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-8">
          {/* Datos de la persona */}
          <fieldset className="rounded-2xl border border-border bg-card p-6 sm:p-7">
            <legend className="px-2 font-display text-lg font-bold">Datos de la persona</legend>

            <div className="flex flex-col sm:flex-row gap-5 mt-2">
              <div className="shrink-0">
                <span className={labelCls}>Foto (opcional)</span>
                <label className="block w-32 h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/50 cursor-pointer overflow-hidden relative transition-colors">
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

              <div className="flex-1 grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="nombre" className={labelCls}>Nombre *</label>
                  <input id="nombre" name="nombre" required className={inputCls} placeholder="Ej. María" />
                </div>
                <div>
                  <label htmlFor="apellido" className={labelCls}>Apellido *</label>
                  <input id="apellido" name="apellido" required className={inputCls} placeholder="Ej. Fernández" />
                </div>
                <div>
                  <label htmlFor="cedula" className={labelCls}>Cédula</label>
                  <input id="cedula" name="cedula" inputMode="numeric" className={inputCls} placeholder="V-12345678" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="edad_aproximada" className={labelCls}>Edad aprox.</label>
                    <input id="edad_aproximada" name="edad_aproximada" type="number" min={0} max={130} className={inputCls} placeholder="34" />
                  </div>
                  <div>
                    <label htmlFor="genero" className={labelCls}>Género</label>
                    <select id="genero" name="genero" className={inputCls} defaultValue="">
                      <option value="">—</option>
                      <option value="M">M</option>
                      <option value="F">F</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="ultimo_lugar_visto" className={labelCls}>Último lugar visto</label>
              <input id="ultimo_lugar_visto" name="ultimo_lugar_visto" className={inputCls} placeholder="Ej. Macuto, cerca del malecón" />
            </div>
            <div className="mt-4">
              <label htmlFor="informacion_adicional" className={labelCls}>Información adicional</label>
              <textarea id="informacion_adicional" name="informacion_adicional" rows={3} className={inputCls} placeholder="Vestimenta, señas particulares, estado de salud…" />
            </div>
          </fieldset>

          {/* Datos de contacto */}
          <fieldset className="rounded-2xl border border-border bg-card p-6 sm:p-7">
            <legend className="px-2 font-display text-lg font-bold">¿A quién contactar?</legend>
            <p className="text-sm text-gray-500 mb-4 mt-1">
              Quien tenga información usará estos datos. Indica al menos un teléfono.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="contacto_nombre" className={labelCls}>Tu nombre *</label>
                <input id="contacto_nombre" name="contacto_nombre" required className={inputCls} />
              </div>
              <div>
                <label htmlFor="contacto_apellido" className={labelCls}>Tu apellido *</label>
                <input id="contacto_apellido" name="contacto_apellido" required className={inputCls} />
              </div>
              <div>
                <label htmlFor="contacto_telefono_nacional" className={labelCls}>Teléfono nacional</label>
                <input id="contacto_telefono_nacional" name="contacto_telefono_nacional" inputMode="tel" className={inputCls} placeholder="0412-1234567" />
              </div>
              <div>
                <label htmlFor="contacto_telefono_internacional" className={labelCls}>Teléfono internacional</label>
                <input id="contacto_telefono_internacional" name="contacto_telefono_internacional" inputMode="tel" className={inputCls} placeholder="+1 555 123 4567" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="contacto_correo" className={labelCls}>Correo electrónico</label>
                <input id="contacto_correo" name="contacto_correo" type="email" className={inputCls} placeholder="tucorreo@ejemplo.com" />
              </div>
            </div>
          </fieldset>

          {error && (
            <p className="text-sm text-crisis bg-crisis-light border border-crisis/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Link href="/" className="text-center rounded-lg border border-border hover:bg-muted text-gray-700 font-semibold px-6 py-3 text-sm transition-colors">
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-crisis hover:bg-crisis-dark text-white font-semibold px-8 py-3 text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Registrando…" : "Publicar reporte"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
