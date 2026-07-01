import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/catastrophe/ayuda-tipos?organization_id=
 * Catálogo de tipos de ayuda del centro (Higiene, Combo alimentario, etc.).
 */
export async function GET(request: NextRequest) {
  const supabase = await createServiceClient()
  const organization_id = request.nextUrl.searchParams.get('organization_id')
  if (!organization_id) {
    return Response.json({ data: null, error: 'organization_id es requerido' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('ayuda_tipos')
    .select('*')
    .eq('organization_id', organization_id)
    .order('nombre', { ascending: true })

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null })
}

/**
 * POST /api/catastrophe/ayuda-tipos
 * Crea un nuevo tipo de ayuda. Body: { organization_id, nombre }
 */
export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  let body: { organization_id?: string; nombre?: string }
  try { body = await request.json() } catch {
    return Response.json({ data: null, error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.organization_id)
    return Response.json({ data: null, error: 'organization_id es requerido' }, { status: 400 })
  const nombre = body.nombre?.trim()
  if (!nombre)
    return Response.json({ data: null, error: 'El nombre es requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('ayuda_tipos')
    .insert({ organization_id: body.organization_id, nombre })
    .select()
    .single()

  if (error) {
    if (error.code === '23505')
      return Response.json({ data: null, error: 'Ya existe un tipo de ayuda con ese nombre' }, { status: 409 })
    return Response.json({ data: null, error: error.message }, { status: 500 })
  }
  return Response.json({ data, error: null }, { status: 201 })
}
