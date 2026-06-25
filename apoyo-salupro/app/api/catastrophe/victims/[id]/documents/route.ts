import type { NextRequest } from 'next/server'
import {
  uploadVictimDocument,
  getVictimDocuments,
  deleteVictimDocument,
} from '@/lib/supabase/storage'

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/catastrophe/victims/[id]/documents'>,
) {
  const { id } = await ctx.params
  const { searchParams } = request.nextUrl
  const organization_id = searchParams.get('organization_id')

  if (!organization_id) {
    return Response.json({ data: null, error: 'organization_id requerido' }, { status: 400 })
  }

  const { data, error } = await getVictimDocuments(organization_id, id)
  if (error) return Response.json({ data: null, error }, { status: 500 })
  return Response.json({ data, error: null })
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/catastrophe/victims/[id]/documents'>,
) {
  const { id } = await ctx.params

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ data: null, error: 'FormData inválido' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const organization_id = formData.get('organization_id') as string | null

  if (!file || !organization_id) {
    return Response.json(
      { data: null, error: 'file y organization_id son requeridos' },
      { status: 400 },
    )
  }

  const { path, error } = await uploadVictimDocument(organization_id, id, file)
  if (error) return Response.json({ data: null, error }, { status: 500 })
  return Response.json({ data: { path }, error: null }, { status: 201 })
}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<'/api/catastrophe/victims/[id]/documents'>,
) {
  const { searchParams } = request.nextUrl
  const path = searchParams.get('path')

  if (!path) {
    return Response.json({ data: null, error: 'path requerido' }, { status: 400 })
  }

  const { error } = await deleteVictimDocument(path)
  if (error) return Response.json({ data: null, error }, { status: 500 })
  return Response.json({ data: { path }, error: null })
}
