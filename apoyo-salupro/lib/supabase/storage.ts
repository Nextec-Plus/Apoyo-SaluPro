import { createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'catastrophe-documents'

export async function uploadVictimDocument(
  organizationId: string,
  victimId: string,
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  const supabase = await createServiceClient()
  const ext = file.name.split('.').pop()
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const path = `${organizationId}/${victimId}/${filename}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })

  if (error) return { path: null, error: error.message }
  return { path, error: null }
}

export async function getVictimDocuments(
  organizationId: string,
  victimId: string,
): Promise<{ data: Array<{ name: string; path: string; signedUrl: string }> | null; error: string | null }> {
  const supabase = await createServiceClient()
  const prefix = `${organizationId}/${victimId}/`

  const { data: files, error: listError } = await supabase.storage.from(BUCKET).list(prefix)
  if (listError) return { data: null, error: listError.message }
  if (!files || files.length === 0) return { data: [], error: null }

  const paths = files.map((f) => `${prefix}${f.name}`)
  const { data: urls, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, 3600)

  if (urlError) return { data: null, error: urlError.message }

  const result = (urls ?? [])
    .filter((u) => u.signedUrl !== null)
    .map((u, i) => ({
      name: files[i].name,
      path: paths[i],
      signedUrl: u.signedUrl as string,
    }))

  return { data: result, error: null }
}

export async function deleteVictimDocument(
  path: string,
): Promise<{ error: string | null }> {
  const supabase = await createServiceClient()
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) return { error: error.message }
  return { error: null }
}

// ── Missing persons images (public bucket, no auth required) ──────────────────

const MISSING_BUCKET = 'missing-persons-images'

export async function uploadMissingPersonImage(
  missingPersonId: string,
  file: File,
): Promise<{ path: string | null; publicUrl: string | null; error: string | null }> {
  const supabase = await createServiceClient()
  const ext = file.name.split('.').pop()
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const path = `${missingPersonId}/${filename}`

  const { error } = await supabase.storage.from(MISSING_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })

  if (error) return { path: null, publicUrl: null, error: error.message }

  const { data } = supabase.storage.from(MISSING_BUCKET).getPublicUrl(path)
  return { path, publicUrl: data.publicUrl, error: null }
}

export async function getMissingPersonImages(
  missingPersonId: string,
): Promise<{ data: Array<{ name: string; publicUrl: string }> | null; error: string | null }> {
  const supabase = await createServiceClient()
  const prefix = `${missingPersonId}/`

  const { data: files, error: listError } = await supabase.storage.from(MISSING_BUCKET).list(prefix)
  if (listError) return { data: null, error: listError.message }
  if (!files || files.length === 0) return { data: [], error: null }

  const result = files.map((f) => ({
    name: f.name,
    publicUrl: supabase.storage.from(MISSING_BUCKET).getPublicUrl(`${prefix}${f.name}`).data.publicUrl,
  }))

  return { data: result, error: null }
}

export async function deleteMissingPersonImage(
  path: string,
): Promise<{ error: string | null }> {
  const supabase = await createServiceClient()
  const { error } = await supabase.storage.from(MISSING_BUCKET).remove([path])
  if (error) return { error: error.message }
  return { error: null }
}
