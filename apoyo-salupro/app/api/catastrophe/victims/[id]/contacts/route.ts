import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { InsertCatastropheFamilyContact } from '@/lib/types/database'

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/catastrophe/victims/[id]/contacts'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('catastrophe_family_contacts')
    .select('*')
    .eq('victim_id', id)
    .order('is_emergency_contact', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null })
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/catastrophe/victims/[id]/contacts'>,
) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  let body: Omit<InsertCatastropheFamilyContact, 'victim_id'>
  try {
    body = await request.json()
  } catch {
    return Response.json({ data: null, error: 'Body inválido' }, { status: 400 })
  }

  if (!body.nombre_contacto || !body.relacion || !body.organization_id) {
    return Response.json(
      { data: null, error: 'nombre_contacto, relacion y organization_id son requeridos' },
      { status: 400 },
    )
  }

  // If this contact is emergency, clear existing emergency contact
  if (body.is_emergency_contact) {
    await supabase
      .from('catastrophe_family_contacts')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ is_emergency_contact: false } as any)
      .eq('victim_id', id)
      .eq('is_emergency_contact', true)
  }

  const { data, error } = await supabase
    .from('catastrophe_family_contacts')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ ...body, victim_id: id } as any)
    .select()
    .single()

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null }, { status: 201 })
}
