import { supabase } from './supabase'

const BUCKET = 'pointage-photos'

export async function uploadPointagePhoto(file, employeeId) {
  const path = `${employeeId}-${Date.now()}.jpg`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
