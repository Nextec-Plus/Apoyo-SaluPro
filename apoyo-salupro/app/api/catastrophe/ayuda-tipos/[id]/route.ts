import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * PATCH /api/catastrophe/ayuda-tipos/[id]
 * Renombra un tipo de ayuda existente. Body: { nombre }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServiceClient()

  let body: { nombre?: string }
  try { body = await request.json() } catch {
    return Response.json({ data: null, error: 'JSON inválido' }, { status: 400 })
  }

  const nombre = body.nombre?.trim()
  if (!nombre)
    return Response.json({ data: null, error: 'El nombre es requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('ayuda_tipos')
    .update({ nombre })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505')
      return Response.json({ data: null, error: 'Ya existe un tipo de ayuda con ese nombre' }, { status: 409 })
    return Response.json({ data: null, error: error.message }, { status: 500 })
  }
  return Response.json({ data, error: null })
}
