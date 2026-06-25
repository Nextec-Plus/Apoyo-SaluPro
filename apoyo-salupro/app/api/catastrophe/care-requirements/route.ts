import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { InsertCatastropheCareRequirement, CareState } from '@/lib/types/database'

export async function GET(request: NextRequest) {
  const supabase = await createServiceClient()
  const { searchParams } = request.nextUrl

  const organization_id = searchParams.get('organization_id')
  const care_state = searchParams.get('care_state') as CareState | null
  const provider_id = searchParams.get('provider_id')

  if (!organization_id) {
    return Response.json({ data: null, error: 'organization_id requerido' }, { status: 400 })
  }

  let query = supabase
    .from('catastrophe_care_requirements')
    .select('*')
    .eq('organization_id', organization_id)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (care_state) query = query.eq('care_state', care_state)

  // Provider-specific config OR global (provider_id IS NULL)
  if (provider_id) {
    query = query.or(`provider_id.eq.${provider_id},provider_id.is.null`)
  } else {
    query = query.is('provider_id', null)
  }

  const { data, error } = await query

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null })
}

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  let body: InsertCatastropheCareRequirement
  try {
    body = await request.json()
  } catch {
    return Response.json({ data: null, error: 'Body inválido' }, { status: 400 })
  }

  if (!body.organization_id || !body.care_state || !body.field_name || !body.field_label) {
    return Response.json(
      { data: null, error: 'organization_id, care_state, field_name y field_label son requeridos' },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('catastrophe_care_requirements')
    .insert(body)
    .select()
    .single()

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data, error: null }, { status: 201 })
}
