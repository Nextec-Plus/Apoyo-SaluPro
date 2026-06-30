import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import {
  type MissingPersonWithImages,
  missingPersonImageUrl,
  STATUS_META,
} from "@/lib/missing-persons";
import { StatusActions } from "./status-actions";
import {
  isReferidoHospitalNotas,
  parseDestino,
  OBSERVACION_MODULO_MOVIL,
} from "@/lib/catastrophe-destinos";

function formatFoundLocation(lugar: string | null | undefined): { icon: string; text: string } {
  if (!lugar) return { icon: "", text: "" };
  if (isReferidoHospitalNotas(lugar)) {
    const { hospital } = parseDestino(lugar);
    return { icon: "🏥", text: hospital || "Hospital" };
  }
  if (lugar.startsWith(OBSERVACION_MODULO_MOVIL)) return { icon: "🩺", text: lugar };
  if (lugar.startsWith("Dado de alta (Ambulatorio)")) return { icon: "✅", text: lugar };
  if (lugar === "Trasladado a Refugio Oficial") return { icon: "🏠", text: lugar };
  return { icon: "📍", text: lugar };
}

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 text-right">{value}</dd>
    </div>
  );
}

export default async function PersonaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("missing_persons")
    .select("*, missing_person_images(*)")
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  const p = data as MissingPersonWithImages;
  const m = STATUS_META[p.estado];
  const images = p.missing_person_images ?? [];

  return (
    <div className="min-h-screen bg-muted">
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-4xl px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image src="/logo_salupro_light.png" alt="SaluPro" width={140} height={42} priority className="h-8 w-auto" />
          </Link>
          <Link href="/#casos" className="text-sm font-medium text-gray-500 hover:text-gray-800">
            ← Registro
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="grid md:grid-cols-[280px_1fr] gap-8">
          {/* Foto + estado */}
          <div>
            <div className="aspect-square rounded-2xl overflow-hidden bg-primary-light flex items-center justify-center text-primary/40 border border-border">
              {images[0] ? (
                <Image
                  src={missingPersonImageUrl(images[0].storage_path)}
                  alt={`${p.nombre} ${p.apellido}`}
                  width={400}
                  height={400}
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} className="w-24 h-24">
                  <path d="M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {images.slice(1, 5).map((img) => (
                  <div key={img.id} className="aspect-square rounded-lg overflow-hidden border border-border">
                    <Image
                      src={missingPersonImageUrl(img.storage_path)}
                      alt=""
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
            <span className={`mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${m.chip}`}>
              <span className={`w-2 h-2 rounded-full ${m.dot}`} />
              {m.label}
            </span>
          </div>

          {/* Detalles */}
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
              {p.nombre} {p.apellido}
            </h1>
            {p.ultimo_lugar_visto && (
              <p className="mt-2 text-gray-600">
                {p.estado === "Encontrado" ? (() => {
                  const { icon, text } = formatFoundLocation(p.ultimo_lugar_visto);
                  const isStatusOnly = icon === "✅" || icon === "🏠";
                  return isStatusOnly
                    ? <span className="font-medium">{icon} {text}</span>
                    : <><span>Se encuentra en </span><span className="font-semibold">{icon} {text}</span></>;
                })() : (
                  <>Visto por última vez en {p.ultimo_lugar_visto}</>
                )}
              </p>
            )}

            <div className="mt-6 rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-lg font-bold mb-2">Datos</h2>
              <dl>
                <Row label="Cédula" value={p.cedula} />
                <Row label="Edad aproximada" value={p.edad_aproximada ? `${p.edad_aproximada} años` : null} />
                <Row label="Género" value={p.genero} />
                {p.estado === "Encontrado" && p.ultimo_lugar_visto ? (() => {
                  const { icon, text } = formatFoundLocation(p.ultimo_lugar_visto);
                  return <Row label="Ubicación actual" value={`${icon} ${text}`.trim()} />;
                })() : (
                  <Row label="Último lugar visto" value={p.ultimo_lugar_visto} />
                )}
              </dl>
              {p.informacion_adicional && (
                <p className="mt-4 text-sm text-gray-700 leading-relaxed bg-muted/60 rounded-lg p-4">
                  {p.informacion_adicional}
                </p>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-primary/20 bg-primary-light/40 p-6">
              <h2 className="font-display text-lg font-bold mb-1">¿Tienes información?</h2>
              <p className="text-sm text-gray-600 mb-4">
                Contacta a {p.contacto_nombre} {p.contacto_apellido}.
              </p>
              <div className="flex flex-wrap gap-2.5">
                {p.contacto_telefono_nacional && (
                  <a href={`tel:${p.contacto_telefono_nacional}`} className="inline-flex items-center gap-2 rounded-lg bg-primary hover:bg-primary-dark text-white font-semibold px-4 py-2.5 text-sm transition-colors">
                    Llamar (nacional)
                  </a>
                )}
                {p.contacto_telefono_internacional && (
                  <a href={`tel:${p.contacto_telefono_internacional}`} className="inline-flex items-center gap-2 rounded-lg bg-primary hover:bg-primary-dark text-white font-semibold px-4 py-2.5 text-sm transition-colors">
                    Llamar (internacional)
                  </a>
                )}
                {p.contacto_correo && (
                  <a href={`mailto:${p.contacto_correo}`} className="inline-flex items-center gap-2 rounded-lg border border-primary/30 text-primary hover:bg-primary-light font-semibold px-4 py-2.5 text-sm transition-colors">
                    Enviar correo
                  </a>
                )}
              </div>
            </div>

            <StatusActions id={p.id} estado={p.estado} />
          </div>
        </div>
      </main>
    </div>
  );
}
