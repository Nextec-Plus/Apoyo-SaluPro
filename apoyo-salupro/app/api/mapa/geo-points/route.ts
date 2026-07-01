import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('supply_requests')
    .select('id, nombre, latitud, longitud, estado')
    .not('latitud', 'is', null)
    .not('longitud', 'is', null)

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })

  const puntos = (data ?? []).map((r) => ({
    lat: r.latitud as number,
    lng: r.longitud as number,
    weight: 1,
    nombre: r.nombre as string,
    estado: r.estado as string,
  }))

  return Response.json({ data: puntos, error: null })
}
