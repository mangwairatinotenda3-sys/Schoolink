// Invite links must point at the public web address, not at whatever the app is running on.
// Inside the Android app the address is local to the phone, so links built from it would not open for anyone else.
export const SITE_URL = 'https://mangwairatinotenda3-sys.github.io/Schoolink/'

export function joinLink(code) {
  return `${SITE_URL}#/join/${encodeURIComponent(code)}`
}
