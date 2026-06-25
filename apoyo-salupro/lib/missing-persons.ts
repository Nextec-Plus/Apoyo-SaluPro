import type { MissingPerson, MissingPersonStatus } from "@/lib/types/database";

/** Una imagen tal como la devuelve el join `missing_person_images(*)`. */
export type MissingPersonImageRow = {
  id: string;
  missing_person_id: string;
  storage_path: string;
  created_at: string;
};

/** Reporte de persona desaparecida con sus imágenes (forma del API). */
export type MissingPersonWithImages = MissingPerson & {
  missing_person_images: MissingPersonImageRow[];
};

const PUBLIC_BUCKET = "missing-persons-images";

/**
 * Construye la URL pública permanente de una imagen del bucket público.
 * El bucket es público por diseño (las fotos deben poder compartirse), así que
 * la URL se puede derivar en el cliente sin firmar.
 */
export function missingPersonImageUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${PUBLIC_BUCKET}/${storagePath}`;
}

/** Primera imagen de un reporte, o `null` si no tiene. */
export function firstImageUrl(p: MissingPersonWithImages): string | null {
  const img = p.missing_person_images?.[0];
  return img ? missingPersonImageUrl(img.storage_path) : null;
}

export const STATUS_META: Record<
  MissingPersonStatus,
  { label: string; dot: string; chip: string }
> = {
  Desaparecido: {
    label: "En búsqueda",
    dot: "bg-crisis",
    chip: "bg-crisis-light text-crisis",
  },
  Avistado: {
    label: "Avistado",
    dot: "bg-triage-yellow",
    chip: "bg-amber-50 text-amber-700",
  },
  Encontrado: {
    label: "Encontrado",
    dot: "bg-triage-green",
    chip: "bg-primary-light text-primary-dark",
  },
  "Confirmado Fallecido": {
    label: "Confirmado fallecido",
    dot: "bg-gray-400",
    chip: "bg-gray-100 text-gray-600",
  },
};
