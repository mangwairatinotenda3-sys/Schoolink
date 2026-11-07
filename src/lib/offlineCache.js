// Offline reading: every successful read from the database is saved on the phone (or browser),
// per signed-in person. When there is no connection, the app is given the saved copy, so screens
// open with the last data they showed, the way WhatsApp does.
// Only reads are saved. Sending, editing and deleting still need a connection.

const DB_NAME = 'schoolink-offline'
const STORE = 'responses'
const MAX_ENTRIES = 400
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).catch((err) => {
    dbPromise = null
    throw err
  })
  return dbPromise
}

// The signed-in person's id, read from the access token. Requests made without a person
// (the public key) return null and are never saved.
export function ownerFromHeaders(headers) {
  try {
    const auth = headers.get('Authorization') || ''
    const token = auth.replace(/^Bearer\s+/i, '')
    const part = token.split('.')[1]
    if (!part) return null
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
    return json.role === 'authenticated' && json.sub ? json.sub : null
  } catch {
    return null
  }
}

// One saved copy per person, per address, per page of results.
export function cacheKey(owner, url, headers) {
  const range = headers.get('Range') || ''
  const prefer = headers.get('Prefer') || ''
  return `${owner}|${url}|${range}|${prefer}`
}

export async function readSaved(key) {
  try {
    const db = await openDb()
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function saveResponse(key, body, contentType, contentRange) {
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ body, contentType, contentRange, savedAt: Date.now() }, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    prune(db).catch(() => {})
  } catch {
    // saving is best effort; the live app keeps working
  }
}

// Keep the store small: drop the oldest and anything past the age limit.
async function prune(db) {
  const keys = await new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
  if (keys.length <= MAX_ENTRIES) return
  const rows = await new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
  const now = Date.now()
  const ranked = keys.map((k, i) => ({ k, t: rows[i]?.savedAt || 0 })).sort((a, b) => a.t - b.t)
  const drop = ranked.filter((r, i) => i < ranked.length - MAX_ENTRIES || now - r.t > MAX_AGE_MS).map((r) => r.k)
  if (!drop.length) return
  const tx = db.transaction(STORE, 'readwrite')
  drop.forEach((k) => tx.objectStore(STORE).delete(k))
  await new Promise((resolve) => { tx.oncomplete = resolve; tx.onerror = resolve })
}

// Called on sign-out, so the next person on this phone never sees the last person's data.
export async function clearOfflineCache() {
  try {
    const db = await openDb()
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // ignore
  }
}
