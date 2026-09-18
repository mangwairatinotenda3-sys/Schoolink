// Real Google Translate integration — switches the entire live app to
// a target language via the standard googtrans cookie technique, then
// reloads so the translate widget picks it up on load.

export function translatePageTo(langCode) {
  const host = window.location.hostname
  document.cookie = `googtrans=/en/${langCode}; path=/`
  document.cookie = `googtrans=/en/${langCode}; path=/; domain=${host}`
  window.location.reload()
}

export function resetToOriginalLanguage() {
  const host = window.location.hostname
  document.cookie = 'googtrans=/en/en; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC'
  document.cookie = `googtrans=/en/en; path=/; domain=${host}; expires=Thu, 01 Jan 1970 00:00:00 UTC`
  window.location.reload()
}

export function isCurrentlyTranslated() {
  return document.cookie.includes('googtrans=') && !document.cookie.includes('googtrans=/en/en')
}
