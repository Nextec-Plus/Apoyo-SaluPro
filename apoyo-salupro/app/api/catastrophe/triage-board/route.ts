import { getOrganizationId } from '@/lib/config'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServiceClient()
  const organization_id = getOrganizationId()

  const { data, error } = await supabase
    .from('catastrophe_victim_info')
    .select('*, catastrophe_victims(*)')
    .eq('organization_id', organization_id)
    .eq('estado_destino', 'Triaje')
    .order('fecha_hora_entrada', { ascending: true })

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null })
}
