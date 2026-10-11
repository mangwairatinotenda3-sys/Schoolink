import { Capacitor } from '@capacitor/core'
import { App as NativeApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { supabase } from './supabaseClient'
import { OAUTH_ERROR_KEY } from '../components/OAuthErrorBanner.jsx'

// Everything that only matters inside the Android / iPhone app.
// On the website none of this runs.

export const NATIVE_REDIRECT = 'com.schoolink.app://auth'

export function isNativeApp() {
  return Capacitor.isNativePlatform()
}

// Google does not allow sign-in inside an app's built-in browser, so we open the
// phone's real browser, and Google sends the person back to the app through
// the "com.schoolink.app://auth" link.
export async function signInWithGoogleNative() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: NATIVE_REDIRECT,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error) return { data, error }
  await Browser.open({ url: data.url })
  return { data, error: null }
}

// Waits for that link to open the app, reads the sign-in details and signs in.
export function listenForNativeSignIn() {
  if (!isNativeApp()) return
  NativeApp.addListener('appUrlOpen', async ({ url }) => {
    if (!url || !url.startsWith(NATIVE_REDIRECT)) return
    try {
      await Browser.close()
    } catch {
      // closing is not supported everywhere; fine
    }
    const raw = url.includes('#') ? url.split('#')[1] : url.split('?')[1] || ''
    const params = new URLSearchParams(raw)
    const message = params.get('error_description') || params.get('error')
    if (message) {
      try {
        sessionStorage.setItem(OAUTH_ERROR_KEY, message)
      } catch {
        // ignore
      }
      window.location.reload()
      return
    }
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token })
    }
  })
}
