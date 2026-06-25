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
): Promise<{ data: Array<{ name: string; signedUrl: string }> | null; error: string | null }> {
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
