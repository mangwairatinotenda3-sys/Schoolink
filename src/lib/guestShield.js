// Everything that limits guests (people using "Continue as Guest").
// A guest is an anonymous Supabase user. Guests can look around, search and read
// updates, but cannot change anything, download files, or open private pages.

let guest = false
let installed = false

export function isGuestMode() {
  return guest
}

// Ask the app to show the "Sign in to continue" box.
export function askToSignIn(reason = 'action') {
  window.dispatchEvent(new CustomEvent('schoolink:guest-blocked', { detail: { reason } }))
}

// Pages a guest may open. Everything else shows the sign-in wall.
const GUEST_PAGES = [
  '/home', '/search', '/schools', '/users', '/post', '/profile', '/more', '/alumni',
  '/settings/help', '/terms', '/privacy', '/forgot-password', '/reset-password', '/onboarding',
]

export function guestCanOpen(path) {
  if (path === '/') return true
  if (path.endsWith('/propose')) return false
  return GUEST_PAGES.some((p) => path === p || path.startsWith(`${p}/`))
}

function isDownloadLink(a) {
  if (!a) return false
  const href = a.href || ''
  return a.hasAttribute('download') || href.includes('/storage/v1/object/')
}

function installShield() {
  if (installed || typeof document === 'undefined') return
  installed = true

  // Links that run from code (e.g. the photo viewer's download button).
  const originalClick = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    if (guest && isDownloadLink(this)) {
      askToSignIn('download')
      return
    }
    return originalClick.apply(this, arguments)
  }

  // Links a person taps: files and downloads.
  document.addEventListener(
    'click',
    (e) => {
      if (!guest) return
      const a = e.target && e.target.closest ? e.target.closest('a') : null
      if (a && isDownloadLink(a)) {
        e.preventDefault()
        e.stopPropagation()
        askToSignIn('download')
      }
    },
    true
  )

  // No "save image / save video" menu on long press or right click.
  document.addEventListener(
    'contextmenu',
    (e) => {
      if (guest && e.target && e.target.closest && e.target.closest('video, img')) e.preventDefault()
    },
    true
  )

  // Hide the download option in video players.
  const lockVideos = () => {
    document.querySelectorAll('video').forEach((v) => {
      v.setAttribute('controlsList', 'nodownload noplaybackrate')
      v.setAttribute('disablePictureInPicture', '')
    })
  }
  new MutationObserver(() => {
    if (guest) lockVideos()
  }).observe(document.body, { childList: true, subtree: true })
}

export function setGuestMode(on) {
  guest = !!on
  if (guest) installShield()
  }
