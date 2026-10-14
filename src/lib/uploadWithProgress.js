import { supabase } from './supabaseClient.js'

// Uploads one file to Supabase Storage and reports real progress (0 to 1) while it goes.
// Returns the public web address of the uploaded file. Pass an AbortSignal to allow cancelling.
export async function uploadWithProgress({ bucket, path, file, onProgress, signal }) {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const baseUrl = import.meta.env.VITE_SUPABASE_URL
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token || anonKey
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const url = `${baseUrl}/storage/v1/object/${bucket}/${encodedPath}`

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', anonKey)
    xhr.setRequestHeader('cache-control', 'max-age=3600')
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total, e.loaded)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path)
        if (onProgress) onProgress(1, file.size)
        resolve(data.publicUrl)
        return
      }
      let message = `Upload failed (${xhr.status})`
      try {
        const body = JSON.parse(xhr.responseText)
        message = body.message || body.error || message
      } catch {
        // keep the default message
      }
      reject(new Error(message))
    }
    xhr.onerror = () => reject(new Error('No internet connection. Check your network and try again.'))
    xhr.ontimeout = () => reject(new Error('The upload took too long. Try again on a stronger connection.'))
    xhr.onabort = () => reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' }))

    if (signal) {
      if (signal.aborted) {
        xhr.abort()
        return
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }
    xhr.send(file)
  })
}
