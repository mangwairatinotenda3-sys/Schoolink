// Shared bits for the site-controller (team) system.

export const ROLE_LABELS = {
  owner: 'Owner',
  verifier: 'Verifier',
  moderator: 'Moderator',
  support: 'Support',
}

export const INVITE_ROLES = [
  { key: 'verifier', label: 'Verifier', hint: 'Verifies people and schools (blue tick)' },
  { key: 'moderator', label: 'Moderator', hint: 'Handles reports and bans' },
  { key: 'support', label: 'Support', hint: 'Handles complaints' },
]

// Where an invited person opens the invite from WhatsApp / email.
export function inviteLink() {
  return `${window.location.origin}${window.location.pathname}#/team/invite`
}

export function inviteMessage(email, roleKey) {
  const role = ROLE_LABELS[roleKey] || 'team member'
  return `You've been invited to join the Schoolink team as ${role}. Open ${inviteLink()} , sign in with ${email}, then tap Accept.`
}

export function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
