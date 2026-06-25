import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { UpdateCatastropheFamilyContact } from '@/lib/types/database'

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/catastrophe/victims/[id]/contacts/[contactId]'>,
) {
  const { id, contactId } = await ctx.params
  const supabase = await createServiceClient()

  let body: UpdateCatastropheFamilyContact
  try {
    body = await request.json()
  } catch {
    return Response.json({ data: null, error: 'Body inválido' }, { status: 400 })
  }

  // If setting as emergency contact, clear the previous one
  if (body.is_emergency_contact) {
    await supabase
      .from('catastrophe_family_contacts')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ is_emergency_contact: false } as any)
      .eq('victim_id', id)
      .eq('is_emergency_contact', true)
      .neq('id', contactId)
  }

  const { data, error } = await supabase
    .from('catastrophe_family_contacts')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(body as any)
    .eq('id', contactId)
    .eq('victim_id', id)
    .select()
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return Response.json({ data: null, error: error.message }, { status })
  }

  return Response.json({ data, error: null })
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<'/api/catastrophe/victims/[id]/contacts/[contactId]'>,
) {
  const { id, contactId } = await ctx.params
  const supabase = await createServiceClient()

  const { error } = await supabase
    .from('catastrophe_family_contacts')
    .delete()
    .eq('id', contactId)
    .eq('victim_id', id)

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data: { id: contactId }, error: null })
}
