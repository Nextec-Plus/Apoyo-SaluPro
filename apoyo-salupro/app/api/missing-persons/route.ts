import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { InsertMissingPerson, MissingPersonStatus } from '@/lib/types/database'

export async function GET(request: NextRequest) {
  const supabase = await createServiceClient()
  const { searchParams } = request.nextUrl

  const organization_id = searchParams.get('organization_id')
  const estado = searchParams.get('estado') as MissingPersonStatus | null
  const search = searchParams.get('search')
  const cedula = searchParams.get('cedula')

  let query = supabase
    .from('missing_persons')
    .select('*, missing_person_images(*)')
    .order('created_at', { ascending: false })

  if (organization_id) query = query.eq('organization_id', organization_id)
  if (estado) query = query.eq('estado', estado)
  if (cedula) query = query.eq('cedula', cedula)
  if (search) {
    query = query.or(
      `nombre.ilike.%${search}%,apellido.ilike.%${search}%,cedula.ilike.%${search}%`,
    )
  }

  const { data, error } = await query

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null })
}

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  let body: InsertMissingPerson
  try {
    body = await request.json()
  } catch (err) {
    return Response.json(
      { data: null, error: `JSON inválido: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    )
  }

  const nombre = body.nombre?.trim()
  const apellido = body.apellido?.trim()

  if (!nombre) {
    return Response.json({ data: null, error: 'nombre es requerido' }, { status: 400 })
  }
  if (!apellido) {
    return Response.json({ data: null, error: 'apellido es requerido' }, { status: 400 })
  }

  // Los datos de contacto son opcionales. Las columnas contacto_nombre/apellido son
  // NOT NULL en la base de datos, así que normalizamos los ausentes a cadena vacía.
  const insert: InsertMissingPerson = {
    ...body,
    nombre,
    apellido,
    contacto_nombre: body.contacto_nombre?.trim() || '',
    contacto_apellido: body.contacto_apellido?.trim() || '',
  }

  const { data, error } = await supabase
    .from('missing_persons')
    .insert(insert)
    .select()
    .single()

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null }, { status: 201 })
}
