import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createServiceClient()
  const { searchParams } = request.nextUrl
  const organization_id = searchParams.get('organization_id')

  let query = supabase
    .from('missing_person_found')
    .select(
      `
      id,
      match_type,
      created_at,
      missing_persons (
        id,
        nombre,
        apellido,
        cedula,
        estado,
        contacto_nombre,
        contacto_apellido,
        contacto_telefono_nacional
      ),
      catastrophe_victims (
        id,
        nombre_completo,
        cedula,
        registration_number,
        ubicacion_actual_refugio,
        organization_id
      )
    `,
    )
    .order('created_at', { ascending: false })

  const { data, error } = await query

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })

  const filtered = organization_id
    ? (data ?? []).filter((row) => {
        const victim = row.catastrophe_victims as { organization_id?: string } | null
        return victim?.organization_id === organization_id
      })
    : data

  return Response.json({ data: filtered, error: null })
}
