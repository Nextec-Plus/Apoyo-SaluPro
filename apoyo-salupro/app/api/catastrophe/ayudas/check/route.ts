import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

/**
 * GET /api/catastrophe/ayudas/check?organization_id=&cedula=
 * Historial exacto de esa cédula, usado para el aviso de "ya recibió ayuda"
 * al escribir la cédula en el formulario. No bloquea el registro, solo informa.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServiceClient()
  const { searchParams } = request.nextUrl

  const organization_id = searchParams.get('organization_id')
  const cedulaRaw = searchParams.get('cedula')
  const cedula = cedulaRaw ? onlyDigits(cedulaRaw) : ''

  if (!organization_id) {
    return Response.json({ data: null, error: 'organization_id es requerido' }, { status: 400 })
  }
  if (!cedula) {
    return Response.json({ data: [], error: null })
  }

  const { data, error } = await supabase
    .from('ayuda_entregas')
    .select('*, ayuda_entrega_items(*, ayuda_tipos(id, nombre))')
    .eq('organization_id', organization_id)
    .eq('cedula', cedula)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null })
}
