// Small helpers for photos and videos picked on the phone.

export function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDuration(seconds) {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function fileExtension(name) {
  const part = String(name || '').split('.').pop()
  return part && part.length <= 5 && part !== name ? part.toUpperCase() : 'FILE'
}

export function safeFileName(name) {
  return String(name || 'file').replace(/[^\w.\-]+/g, '_')
}

// Makes a big camera photo smaller before it is uploaded: faster to send, cheaper to load, same look.
export async function prepareImage(file, { maxSide = 1600, quality = 0.86 } = {}) {
  if (!file.type.startsWith('image/') || /gif|svg/.test(file.type)) return file
  try {
    const url = URL.createObjectURL(file)
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })
    URL.revokeObjectURL(url)
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    if (scale === 1 && file.size < 900 * 1024) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

// Reads a video's length and grabs a picture from it to use as the thumbnail.
export function videoInfo(url) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    let done = false
    const finish = (value) => {
      if (done) return
      done = true
      video.removeAttribute('src')
      video.load()
      resolve(value)
    }
    const timer = setTimeout(() => finish({ duration: video.duration || 0, poster: null }), 6000)
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.6, (video.duration || 1) / 4)
    }
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight))
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
        clearTimeout(timer)
        finish({ duration: video.duration, poster: canvas.toDataURL('image/jpeg', 0.7), width: video.videoWidth, height: video.videoHeight })
      } catch {
        clearTimeout(timer)
        finish({ duration: video.duration || 0, poster: null })
      }
    }
    video.onerror = () => {
      clearTimeout(timer)
      finish({ duration: 0, poster: null })
    }
    video.src = url
  })
}
