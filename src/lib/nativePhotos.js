import { Capacitor } from '@capacitor/core'

// Opens the phone's own photo gallery, the same sheet WhatsApp, Facebook and TikTok use.
// Returns File objects (an empty list if the person cancels), or null when the gallery is
// not available here, so the caller can fall back to the normal file picker.
export async function pickGalleryPhotos({ limit = 10 } = {}) {
  if (!Capacitor.isNativePlatform()) return null
  let Camera
  try {
    ;({ Camera } = await import('@capacitor/camera'))
  } catch {
    return null
  }
  if (typeof Camera?.pickImages !== 'function') return null

  let result
  try {
    result = await Camera.pickImages({ quality: 90, limit })
  } catch {
    return [] // cancelled, or permission refused
  }

  const photos = result?.photos ?? []
  const files = []
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i]
    try {
      const res = await fetch(p.webPath)
      const blob = await res.blob()
      const ext = String(p.format || blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
      const type = blob.type || `image/${ext}`
      files.push(new File([blob], `photo-${Date.now()}-${i}.${ext}`, { type }))
    } catch {
      // skip a photo that could not be read
    }
  }
  return files
}
