import { createServiceClient } from '@/lib/supabase/server'
import type { MissingPersonStatus } from '@/lib/types/database'

/**
 * GET /api/missing-persons/stats
 *
 * Contadores globales (sin paginar) para la landing:
 *  { total, busquedas, encontradas, error }
 *
 * Es una consulta `head: true` con count exacto (barata en PostgREST).
 * Cacheada en CDN 30s + stale 60s para absorber picos de 2000 usuarios
 * recurrentes sin golpear Supabase en cada visita.
 */
export async function GET() {
  const supabase = await createServiceClient()

  const [totalRes, busquedasRes, encontradasRes] = await Promise.all([
    supabase
      .from('missing_persons')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('missing_persons')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'Desaparecido' as MissingPersonStatus),
    supabase
      .from('missing_persons')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'Encontrado' as MissingPersonStatus),
  ])

  if (totalRes.error) {
    return Response.json({ error: totalRes.error.message }, { status: 500 })
  }

  const res = Response.json({
    total: totalRes.count ?? 0,
    busquedas: busquedasRes.count ?? 0,
    encontradas: encontradasRes.count ?? 0,
    error: null,
  })
  res.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
  return res
}