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

const ICONS = {
  user: "M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  pin: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0ZM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  cal: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  person: "M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
}

function formatGenero(g: string | null) {
  if (!g) return null
  if (g === "M") return "Masculino"
  if (g === "F") return "Femenino"
  return g
}

export function MissingPersonCard({
  p,
  onOpen,
  accent = "primary",
  imageHeight,
}: {
  p: MissingPersonSearchItem
  onOpen: (p: MissingPersonSearchItem) => void
  accent?: "primary" | "crisis"
  /** Si se omite, usa aspect-[3/4] (portrait). Para vistas compactas pasa "h-[180px]", etc. */
  imageHeight?: string
}) {
  const m = STATUS_META[p.estado]
  const img = firstImageUrlFromSearch(p)
  const hover = accent === "crisis" ? "hover:border-crisis/40 hover:shadow-crisis/10" : "hover:border-primary/40 hover:shadow-primary/10"
  const placeholder = accent === "crisis" ? "text-crisis/30" : "text-primary/40"
  const bgPlaceholder = accent === "crisis" ? "bg-crisis/5" : "bg-primary-light"
  const imgCls = imageHeight ?? "aspect-[4/3]"

  const agePart = p.edad_aproximada ? `${p.edad_aproximada} años` : null
  const generoPart = formatGenero(p.genero)
  const metaLine = [agePart, generoPart].filter(Boolean).join(" · ")

  // Para fallecidos mostrar motivo; para el resto, último lugar visto.
  const lugarOMotivo =
    p.estado === "Confirmado Fallecido" ? p.motivo_fallecimiento : p.ultimo_lugar_visto

  const date = p.created_at
    ? new Date(p.created_at).toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" })
    : null

  return (
    <button
      type="button"
      onClick={() => onOpen(p)}
      className={`group flex flex-col rounded-2xl bg-card border border-border overflow-hidden text-left hover:shadow-xl transition-all duration-200 ${hover}`}
    >
      {/* Imagen con badge overlay */}
      <div className={`relative w-full ${imgCls} shrink-0 ${bgPlaceholder} overflow-hidden`}>
        {img ? (
          <Image
            src={img}
            alt={`${p.nombre} ${p.apellido}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            loading="lazy"
            className="object-cover object-top group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className={`absolute inset-0 flex items-center justify-center ${placeholder}`}>
            <Icon path={ICONS.user} className="w-16 h-16" />
          </div>
        )}
        {/* Status badge: overlay top-left */}
        <span
          className={`absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-sm shadow-sm ${m.chip}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
          {m.label}
        </span>
      </div>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <h3 className="font-bold text-lg leading-snug text-gray-900">
          {p.nombre} {p.apellido}
        </h3>

        {metaLine && (
          <p className="text-sm text-gray-500 flex items-center gap-1.5">
            <Icon path={ICONS.person} className="w-3.5 h-3.5 shrink-0 opacity-70" />
            {metaLine}
          </p>
        )}

        {lugarOMotivo && (
          <p className="text-sm text-gray-500 flex items-center gap-1.5 line-clamp-2">
            <Icon path={ICONS.pin} className="w-3.5 h-3.5 shrink-0 opacity-70" />
            {lugarOMotivo}
          </p>
        )}

        {date && (
          <p className="text-xs text-gray-400 mt-auto pt-1 flex items-center gap-1.5">
            <Icon path={ICONS.cal} className="w-3.5 h-3.5 shrink-0 opacity-60" />
            {date}
          </p>
        )}
      </div>
    </button>
  )
}

export function MissingPersonCardSkeleton({
  imageHeight,
}: {
  imageHeight?: string
}) {
  const imgCls = imageHeight ?? "aspect-[4/3]"
  return (
    <div className="rounded-2xl border border-border bg-muted/50 animate-pulse overflow-hidden">
      <div className={`${imgCls} bg-muted`} />
      <div className="p-4 space-y-2">
        <div className="h-5 w-3/4 bg-muted rounded" />
        <div className="h-4 w-1/2 bg-muted rounded" />
        <div className="h-4 w-2/3 bg-muted rounded" />
      </div>
    </div>
  )
}
