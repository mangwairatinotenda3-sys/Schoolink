import { supabase } from './supabaseClient.js'

// Builds the "download my data" file by asking the database for one section at a time.
export async function buildExport({ user, onStep }) {
  const begin = await supabase.rpc('export_begin')
  if (begin.error || !begin.data?.ok) throw new Error(begin.error?.message || begin.data?.error || 'Could not start the download.')

  const overview = await supabase.rpc('export_overview')
  if (overview.error || !overview.data?.ok) throw new Error(overview.error?.message || overview.data?.error || 'Could not read your data.')
  const sections = overview.data.sections ?? []
  onStep({ type: 'plan', sections })

  const out = {}
  for (const s of sections) {
    onStep({ type: 'start', key: s.key })
    const rows = []
    let offset = 0
    for (let page = 0; page < 80; page += 1) {
      const { data, error } = await supabase.rpc('export_section', { p_key: s.key, p_offset: offset })
      if (error || !data?.ok) throw new Error(error?.message || data?.error || `Could not read ${s.label.toLowerCase()}.`)
      rows.push(...(data.rows ?? []))
      onStep({ type: 'progress', key: s.key, done: rows.length })
      if (data.next == null) break
      offset = data.next
    }
    out[s.key] = rows
    onStep({ type: 'done', key: s.key, done: rows.length })
  }

  const payload = {
    app: 'Schoolink',
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email || null },
    about: 'This is a copy of your Schoolink data. Photos and videos are links to the files. Marks, report cards, fee and counselling records belong to your school and are not included.',
    sections: out,
  }
  const text = JSON.stringify(payload, null, 2)
  const stamp = new Date().toISOString().slice(0, 10)
  const name = `schoolink-data-${stamp}.json`
  const blob = new Blob([text], { type: 'application/json' })
  return { blob, name, size: blob.size, counts: sections.map((s) => ({ ...s, count: out[s.key]?.length ?? 0 })) }
}

export function sizeText(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Share sheet first (works well on phones), then a normal download
export async function saveFile(blob, name) {
  const file = new File([blob], name, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'My Schoolink data' })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  return 'downloaded'
          }
