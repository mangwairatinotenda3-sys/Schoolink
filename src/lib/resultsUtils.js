// Shared rules for results and report cards.

export const TERMS = ['Term 1', 'Term 2', 'Term 3']
export const ASSESSMENTS = ['Test', 'Quiz', 'Assignment', 'Mid-term', 'Exam', 'Practical']
export const EDITOR_ROLES = ['Teacher / Tutor', 'Headteacher', 'Deputy Head']
export const ADMIN_ROLES = ['Headteacher', 'Deputy Head']

export const DEFAULT_SCALE = [
  { min: 80, grade: 'A', label: 'Excellent' },
  { min: 70, grade: 'B', label: 'Very good' },
  { min: 60, grade: 'C', label: 'Good' },
  { min: 50, grade: 'D', label: 'Satisfactory' },
  { min: 40, grade: 'E', label: 'Needs improvement' },
  { min: 0, grade: 'U', label: 'Ungraded' },
]

export function normaliseScale(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_SCALE
  const rows = raw
    .map((r) => ({ min: Number(r.min), grade: String(r.grade || '').trim(), label: String(r.label || '').trim() }))
    .filter((r) => Number.isFinite(r.min) && r.grade)
    .sort((a, b) => b.min - a.min)
  if (!rows.length) return DEFAULT_SCALE
  if (rows[rows.length - 1].min > 0) rows.push({ min: 0, grade: rows[rows.length - 1].grade, label: '' })
  return rows
}

export function gradeFor(percent, scale) {
  if (percent == null || Number.isNaN(percent)) return null
  const s = normaliseScale(scale)
  return s.find((r) => percent >= r.min) || s[s.length - 1]
}

// Colours by how well the student did, so a parent can read a card at a glance.
export function tone(percent) {
  if (percent == null) return { text: 'text-gray-500', bg: 'bg-gray-100', bar: 'bg-gray-300', hex: '#9CA3AF' }
  if (percent >= 70) return { text: 'text-green-700', bg: 'bg-green-100', bar: 'bg-green-500', hex: '#22C55E' }
  if (percent >= 55) return { text: 'text-blue-700', bg: 'bg-blue-100', bar: 'bg-blue-500', hex: '#3B82F6' }
  if (percent >= 40) return { text: 'text-amber-700', bg: 'bg-amber-100', bar: 'bg-amber-500', hex: '#F59E0B' }
  return { text: 'text-red-700', bg: 'bg-red-100', bar: 'bg-red-500', hex: '#EF4444' }
}

export function currentTerm(date = new Date()) {
  const m = date.getMonth()
  return m < 4 ? 'Term 1' : m < 8 ? 'Term 2' : 'Term 3'
}

export function percentOf(row) {
  if (row?.score == null || !row.max_score) return null
  return (Number(row.score) / Number(row.max_score)) * 100
}

export function round1(n) {
  return n == null ? null : Math.round(n * 10) / 10
}

export function termKey(row) {
  return `${row.year || ''}|${row.term || ''}`
}

function termOrder(key) {
  const [year, term] = key.split('|')
  const t = TERMS.indexOf(term)
  return Number(year) * 10 + (t === -1 ? 9 : t)
}

export function sortTermKeys(keys, newestFirst = true) {
  return [...keys].sort((a, b) => (newestFirst ? termOrder(b) - termOrder(a) : termOrder(a) - termOrder(b)))
}

export function termLabel(key) {
  const [year, term] = key.split('|')
  return [term, year].filter(Boolean).join(' ')
}

export function listTerms(rows) {
  return sortTermKeys([...new Set(rows.map(termKey))])
}

export function averageOf(rows) {
  const ps = rows.map(percentOf).filter((p) => p != null)
  if (!ps.length) return null
  return round1(ps.reduce((a, b) => a + b, 0) / ps.length)
}

// One line per subject: the average of its assessments this term, with the comment from the teacher.
export function groupSubjects(rows, scale) {
  const map = new Map()
  for (const r of rows) {
    const key = (r.subject || '').trim().toLowerCase()
    if (!map.has(key)) map.set(key, { subject: (r.subject || '').trim(), rows: [] })
    map.get(key).rows.push(r)
  }
  return [...map.values()]
    .map((g) => {
      const percent = averageOf(g.rows)
      const latest = [...g.rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      const legacyGrade = g.rows.find((r) => r.score == null && r.grade)?.grade || ''
      const comment = latest.find((r) => r.comment)?.comment || ''
      return {
        ...g,
        percent,
        grade: percent != null ? gradeFor(percent, scale)?.grade : legacyGrade,
        comment,
        hasDraft: g.rows.some((r) => r.published === false),
      }
    })
    .sort((a, b) => a.subject.localeCompare(b.subject))
}

export function ordinal(n) {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`
}

export function formatScore(row) {
  if (row.score == null) return row.grade || '—'
  const s = Number(row.score)
  const m = Number(row.max_score || 100)
  return `${Number.isInteger(s) ? s : s.toFixed(1)}/${Number.isInteger(m) ? m : m.toFixed(1)}`
}

export function reportText({ student, school, term, subjects, average, overall, position, size }) {
  const lines = [`${student?.full_name || 'Student'} — ${term}`, school?.name || '', '']
  subjects.forEach((s) => lines.push(`${s.subject}: ${s.percent != null ? `${Math.round(s.percent)}%` : '—'} ${s.grade || ''}`.trim()))
  if (average != null) lines.push('', `Average: ${average}%${overall ? ` (${overall.grade})` : ''}`)
  if (position) lines.push(`Class position: ${ordinal(position)} of ${size}`)
  return lines.filter((l, i) => l !== '' || i > 1).join('\n')
}
