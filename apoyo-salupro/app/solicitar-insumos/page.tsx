import { createServiceClient } from '@/lib/supabase/server'
import { SolicitudForm } from './solicitud-form'
import type { InventorySection, InventorySubcategory } from '@/lib/types/database'

export const metadata = {
  title: 'Solicitar Insumos · Apoyo SaluPro',
  description: 'Solicita insumos médicos, alimentos o equipos de emergencia. Apoyo SaluPro Venezuela.',
}

export type SectionWithSubcats = InventorySection & {
  subcategories: InventorySubcategory[]
}

export default async function SolicitudInsumosPage() {
  const supabase = await createServiceClient()

  const [{ data: sections }, { data: subcats }] = await Promise.all([
    supabase.from('inventory_sections').select('*').order('display_order', { ascending: true }),
    supabase.from('inventory_subcategories').select('*').order('display_order', { ascending: true }),
  ])

  const sectionsWithSubcats: SectionWithSubcats[] = (sections ?? []).map((s) => ({
    ...s,
    subcategories: (subcats ?? []).filter((sc) => sc.section_id === s.id),
  }))

  return <SolicitudForm sections={sectionsWithSubcats} />
}
