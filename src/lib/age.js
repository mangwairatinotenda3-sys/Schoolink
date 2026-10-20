import { MIN_AGE } from './legal.js'

// Whole years between a birth date (YYYY-MM-DD) and today.
export function ageFromBirthDate(birthDate) {
  if (!birthDate) return null
  const [y, m, d] = String(birthDate).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  const now = new Date()
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1
  return age
}

export const isTooYoung = (birthDate) => {
  const a = ageFromBirthDate(birthDate)
  return a !== null && a < MIN_AGE
}
