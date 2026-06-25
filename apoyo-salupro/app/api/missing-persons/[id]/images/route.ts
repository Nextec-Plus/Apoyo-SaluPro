import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  uploadMissingPersonImage,
  getMissingPersonImages,
  deleteMissingPersonImage,
} from '@/lib/supabase/storage'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const { data, error } = await getMissingPersonImages(id)

  if (error) return Response.json({ data: null, error }, { status: 500 })
  return Response.json({ data, error: null })
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  let formData: FormData
  try {
    formData = await request.formData()
  } catch (err) {
    return Response.json(
      { data: null, error: `FormData inválido: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    )
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return Response.json({ data: null, error: 'Campo "file" es requerido' }, { status: 400 })
  }

  const { path, publicUrl, error: uploadError } = await uploadMissingPersonImage(id, file)
  if (uploadError) {
    return Response.json({ data: null, error: uploadError }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('missing_person_images')
    .insert({ missing_person_id: id, storage_path: path! })
    .select()
    .single()

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })
  return Response.json({ data: { ...data, publicUrl }, error: null }, { status: 201 })
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const supabase = await createServiceClient()

  const { searchParams } = request.nextUrl
  const imageId = searchParams.get('imageId')
  if (!imageId) {
    return Response.json(
      { data: null, error: 'imageId es requerido como query param' },
      { status: 400 },
    )
  }

  const { data: image, error: fetchError } = await supabase
    .from('missing_person_images')
    .select('storage_path')
    .eq('id', imageId)
    .eq('missing_person_id', id)
    .single()

  if (fetchError) {
    const status = fetchError.code === 'PGRST116' ? 404 : 500
    return Response.json({ data: null, error: fetchError.message }, { status })
  }

  const { error: storageError } = await deleteMissingPersonImage(image.storage_path)
  if (storageError) return Response.json({ data: null, error: storageError }, { status: 500 })

  const { error } = await supabase.from('missing_person_images').delete().eq('id', imageId)
  if (error) return Response.json({ data: null, error: error.message }, { status: 500 })

  return Response.json({ data: { id: imageId }, error: null })
}
