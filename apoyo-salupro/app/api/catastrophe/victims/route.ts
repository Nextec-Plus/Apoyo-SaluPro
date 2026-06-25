import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { InsertCatastropheVictim } from '@/lib/types/database'
import { syncMissingPersonMatches } from '@/lib/missing-person-match'

export async function GET(request: NextRequest) {
  const supabase = await createServiceClient()
  const { searchParams } = request.nextUrl

  const organization_id = searchParams.get('organization_id')
  const cedula = searchParams.get('cedula')
  const search = searchParams.get('search')

  if (!organization_id) {
    return Response.json({ data: null, error: 'organization_id es requerido' }, { status: 400 })
  }

  let query = supabase
    .from('catastrophe_victims')
    .select('*, catastrophe_victim_info(*)')
    .eq('organization_id', organization_id)
    .order('created_at', { ascending: false })

  if (cedula) query = query.eq('cedula', cedula)
  if (search) query = query.ilike('nombre_completo', `%${search}%`)

  const { data, error } = await query

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null })
}

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  let body: InsertCatastropheVictim
  try {
    body = await request.json()
  } catch (err) {
    return Response.json(
      { data: null, error: `JSON inválido: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    )
  }

  if (!body.organization_id) {
    return Response.json({ data: null, error: 'organization_id es requerido' }, { status: 400 })
  }
  if (!body.nombre_completo) {
    return Response.json({ data: null, error: 'nombre_completo es requerido' }, { status: 400 })
  }

  // Auto-generate registration_number: V-001, V-002, ...
  const { count } = await supabase
    .from('catastrophe_victims')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', body.organization_id)

  const nextNumber = String((count ?? 0) + 1).padStart(3, '0')
  const registration_number = `V-${nextNumber}`

  const { data, error } = await supabase
    .from('catastrophe_victims')
    .insert({ ...body, registration_number })
    .select()
    .single()

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })

  const found_matches = await syncMissingPersonMatches(supabase, {
    id: data.id,
    nombre_completo: data.nombre_completo,
    cedula: data.cedula,
    ubicacion_actual_refugio: data.ubicacion_actual_refugio,
  })

  return Response.json({ data, found_matches, error: null }, { status: 201 })
}
