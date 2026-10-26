// Forms / classes a learner can be in, e.g. "Form 2 Orange", "Lower 6", "Grade 5 Blue".
const PRIMARY = ['ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7']
const SECONDARY = ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Lower 6', 'Upper 6']
const TERTIARY = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5']

export const ALL_LEVELS = [...PRIMARY, ...SECONDARY, ...TERTIARY]

export function levelsFor(schoolType) {
  const t = String(schoolType || '').toLowerCase()
  if (t.includes('primary')) return PRIMARY
  if (t.includes('college') || t.includes('university')) return TERTIARY
  if (t.includes('combined')) return [...PRIMARY, ...SECONDARY]
  if (t.includes('high') || t.includes('secondary')) return SECONDARY
  return [...PRIMARY, ...SECONDARY]
}

export function parseForm(value, levels = ALL_LEVELS) {
  const v = String(value || '').trim()
  const sorted = [...levels].sort((a, b) => b.length - a.length)
  const level = sorted.find((l) => v.toLowerCase().startsWith(l.toLowerCase()))
  if (!level) return { level: '', stream: v }
  return { level, stream: v.slice(level.length).trim() }
}

export function joinForm(level, stream) {
  return `${level || ''} ${stream || ''}`.trim().slice(0, 40)
}

// "Form 2 Orange" -> "Form 2" (used to group learners)
export function levelOf(value) {
  const { level } = parseForm(value, ALL_LEVELS)
  return level || (String(value || '').trim() ? 'Other' : 'No form yet')
}

export function levelRank(level) {
  const i = ALL_LEVELS.indexOf(level)
  if (level === 'No form yet') return 998
  return i === -1 ? 997 : i
  }
