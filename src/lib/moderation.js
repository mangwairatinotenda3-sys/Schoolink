// Shared moderation helpers: report reasons/labels (used by ReportsQueue)
// and a lightweight profanity filter (used by AddPost).

export const reportReasons = [
  { key: 'spam', label: 'Spam or scam' },
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'hate', label: 'Hate speech' },
  { key: 'inappropriate', label: 'Inappropriate or explicit content' },
  { key: 'violence', label: 'Violence or threats' },
  { key: 'impersonation', label: 'Impersonation' },
  { key: 'misinformation', label: 'False information' },
  { key: 'other', label: 'Other' },
]

// Keys match content_reports.content_type and the contentTables map in ReportsQueue.
export const contentTypeLabels = {
  post: 'Post',
  comment: 'Comment',
  message: 'Message',
  community_message: 'Community message',
  community: 'Community',
  library_resource: 'Library resource',
  school_gallery: 'Gallery photo',
  school_document: 'School document',
  user: 'User',
  status: 'Status',
}

// Add or remove words here. Matching is whole-word, case-insensitive, and
// tolerant of common character swaps (@ for a, 0 for o, etc.).
const blockedWords = [
  'fuck', 'fucking', 'fucker', 'motherfucker',
  'shit', 'bullshit',
  'bitch', 'bastard',
  'asshole', 'dickhead',
  'cunt', 'slut', 'whore',
  'nigger', 'nigga', 'faggot',
  'retard',
]

const substitutions = {
  '@': 'a', '4': 'a',
  '3': 'e',
  '1': 'i', '!': 'i', '|': 'i',
  '0': 'o',
  '$': 's', '5': 's',
  '7': 't', '+': 't',
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[@4310!|$57+]/g, (ch) => substitutions[ch] || ch)
    .replace(/(.)\1{2,}/g, '$1$1') // "fuuuuck" -> "fuuck"
}

const blockedPatterns = blockedWords.map((w) => {
  // allow repeated letters inside the word: f+u+c+k+
  const loose = w.split('').map((c) => `${c}+`).join('')
  return new RegExp(`(^|[^a-z])${loose}($|[^a-z])`, 'i')
})

export function containsProfanity(text) {
  const cleaned = normalize(text)
  if (!cleaned.trim()) return false
  return blockedPatterns.some((re) => re.test(cleaned))
}
