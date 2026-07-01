import type { SupabaseClient } from "@supabase/supabase-js"

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g")

/**
 * Deriva un código en mayúsculas a partir de un nombre (ej: "Material de Curas" -> "MATERIAL_DE_CURAS").
 */
function slugifyCode(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24)
  return base || "ITEM"
}

/**
 * Genera un código único para `table` a partir de `name`, agregando un sufijo
 * numérico si el código base ya existe (la columna `code` tiene UNIQUE).
 */
export async function generateUniqueCode(
  supabase: SupabaseClient,
  table: "inventory_sections" | "inventory_subcategories",
  name: string,
): Promise<string> {
  const base = slugifyCode(name)
  const { data } = await supabase.from(table).select("code").ilike("code", `${base}%`)
  const existing = new Set((data ?? []).map((r: { code: string }) => r.code))

  if (!existing.has(base)) return base
  let n = 2
  while (existing.has(`${base}_${n}`)) n++
  return `${base}_${n}`
}
