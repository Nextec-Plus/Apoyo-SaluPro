import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { InsertSupplyRequest, SupplyRequestStatus, SolicitorType } from '@/lib/types/database'

export async function POST(request: Request) {
  const body = await request.json() as InsertSupplyRequest

  const { nombre, telefono } = body
  if (!nombre?.trim()) {
    return Response.json({ error: 'El nombre es obligatorio.' }, { status: 400 })
  }
  if (!telefono?.trim()) {
    return Response.json({ error: 'El teléfono es obligatorio.' }, { status: 400 })
  }

  // Use service client so anon users can insert (bypasses RLS session check).
  // The RLS policy "anon_insert_supply_requests" already allows this via anon key,
  // but service client is more reliable across Supabase plan variations.
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('supply_requests')
    .insert({
      nombre: nombre.trim(),
      cedula_rif: body.cedula_rif?.trim() || null,
      telefono: telefono.trim(),
      correo: body.correo?.trim() || null,
      tipo_solicitante: body.tipo_solicitante ?? 'Persona',
      latitud: body.latitud ?? null,
      longitud: body.longitud ?? null,
      direccion: body.direccion?.trim() || null,
      secciones_solicitadas: body.secciones_solicitadas ?? [],
      notas: body.notas?.trim() || null,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data, error: null }, { status: 201 })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autorizado.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const estado = searchParams.get('estado') as SupplyRequestStatus | null
  const tipo = searchParams.get('tipo') as SolicitorType | null
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? '25')))
  const offset = (page - 1) * limit

  let q = supabase
    .from('supply_requests')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (estado) q = q.eq('estado', estado)
  if (tipo) q = q.eq('tipo_solicitante', tipo)

  const { data, error, count } = await q

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data, count, error: null })
}
