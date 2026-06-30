import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getCenterId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('acopio_user_assignments')
    .select('acopio_center_id')
    .eq('user_id', user.id)
    .single()
  return data?.acopio_center_id ?? null
}

/** GET /api/inventory/locations — ubicaciones del centro del usuario. */
export async function GET() {
  const supabase = await createClient()
  const centerId = await getCenterId(supabase)
  if (!centerId) return Response.json({ data: null, error: 'Sin asignación de centro' }, { status: 403 })

  const { data, error } = await supabase
    .from('inventory_locations')
    .select('*')
    .eq('acopio_center_id', centerId)
    .order('name', { ascending: true })

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null })
}

/** POST /api/inventory/locations — crea una ubicación para el centro del usuario. */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const centerId = await getCenterId(supabase)
  if (!centerId) return Response.json({ data: null, error: 'Sin asignación de centro' }, { status: 403 })

  let body: { name?: string; description?: string }
  try { body = await request.json() } catch {
    return Response.json({ data: null, error: 'JSON inválido' }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) return Response.json({ data: null, error: 'name es requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('inventory_locations')
    .insert({ acopio_center_id: centerId, name, description: body.description?.trim() || null })
    .select()
    .single()

  if (error) {
    const status = error.code === '23505' ? 409 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }
  return Response.json({ data, error: null }, { status: 201 })
}
