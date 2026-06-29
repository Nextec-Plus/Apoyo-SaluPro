import { getOrganizationId } from '@/lib/config'
import { createServiceClient } from '@/lib/supabase/server'
import { OBSERVACION_MODULO_MOVIL } from '@/lib/catastrophe-destinos'

export async function GET() {
  const supabase = await createServiceClient()
  const organization_id = getOrganizationId()

  const { data, error } = await supabase
  .from('catastrophe_victim_info')
  .select('*, catastrophe_victims!inner(*)')
  .eq('organization_id', organization_id)
  .eq('estado_destino', 'Triaje')
  .or(`notas.eq.${OBSERVACION_MODULO_MOVIL}`, { referencedTable: 'catastrophe_victims' })
  .order('fecha_hora_entrada', { ascending: true })

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null })
}
