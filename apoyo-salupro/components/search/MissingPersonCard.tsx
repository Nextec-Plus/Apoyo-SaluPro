"use client";

import Image from "next/image"
import { firstImageUrlFromSearch, STATUS_META } from "@/lib/missing-persons"
import type { MissingPersonSearchItem } from "@/lib/search/types"

function Icon({ path, className = "" }: { path: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  )
}

const USER_ICON = "M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"

function chunkExtras(p: MissingPersonSearchItem) {
  // Para fallecidos el detalle relevante es el motivo, no el último lugar visto.
  const detalle =
    p.estado === "Confirmado Fallecido" ? p.motivo_fallecimiento : p.ultimo_lugar_visto
  return [p.edad_aproximada ? `${p.edad_aproximada} años` : null, detalle]
    .filter(Boolean)
    .join(" · ") || "Sin detalles"
}

export function MissingPersonCard({
  p,
  onOpen,
  accent = "primary",
  imageHeight = "h-[300px]",
}: {
  p: MissingPersonSearchItem
  onOpen: (p: MissingPersonSearchItem) => void
  /** Borde hover accent: primary (landing) | crisis (desaparecidos). */
  accent?: "primary" | "crisis"
  imageHeight?: string
}) {
  const m = STATUS_META[p.estado]
  const img = firstImageUrlFromSearch(p)
  const hover = accent === "crisis" ? "hover:border-crisis/40 hover:shadow-crisis/5" : "hover:border-primary/40 hover:shadow-primary/5"
  const placeholder = accent === "crisis" ? "text-crisis/30" : "text-primary/40"
  const bgPlaceholder = accent === "crisis" ? "bg-crisis/5" : "bg-primary-light"

  return (
    <button
      type="button"
      onClick={() => onOpen(p)}
      className={`group flex flex-col rounded-2xl bg-card border border-border overflow-hidden text-left hover:shadow-lg transition-all ${hover}`}
    >
      <div className={`relative w-full ${imageHeight} shrink-0 ${bgPlaceholder} overflow-hidden`}>
        {img ? (
          <Image
            src={img}
            alt={`${p.nombre} ${p.apellido}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading="lazy"
            className="object-cover object-center group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <div className={`absolute inset-0 flex items-center justify-center ${placeholder}`}>
            <Icon path={USER_ICON} className="w-12 h-12" />
          </div>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-[15px] leading-snug">
          {p.nombre} {p.apellido}
        </h3>
        <p className="text-xs text-gray-500 mt-1 line-clamp-2 flex-1">
          {chunkExtras(p)}
        </p>
        <span className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold self-start ${m.chip}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
          {m.label}
        </span>
      </div>
    </button>
  )
}

export function MissingPersonCardSkeleton({
  imageHeight = "h-[200px]",
}: {
  imageHeight?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/50 animate-pulse overflow-hidden">
      <div className={`${imageHeight} bg-muted`} />
      <div className="p-4 space-y-2">
        <div className="h-4 w-2/3 bg-muted rounded" />
        <div className="h-3 w-1/2 bg-muted rounded" />
      </div>
    </div>
  )
}