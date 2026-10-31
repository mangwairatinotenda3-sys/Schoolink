import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { CallProvider } from './context/CallContext.jsx'
import CallOverlay from './components/CallOverlay.jsx'
import ThemeProvider from './lib/ThemeProvider.jsx'
import OAuthErrorBanner, { OAUTH_ERROR_KEY } from './components/OAuthErrorBanner.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { supabase } from './lib/supabaseClient'
import { listenForNativeSignIn } from './lib/nativeAuth.js'
import { installCrashReporter } from './lib/crashReporter.js'
import { isNativeApp } from './lib/appPermissions.js'
import './index.css'
import './lib/uiPrefs.js'

// Stop the browser from trying to restore scroll position on refresh —
// it fights with how this app renders content after loading, causing
// the page to jump to a position and then snap back to the top.
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister())
  })
}

// When Google (or an email link) sends the person back, the sign-in details
// arrive in the page address. The router would treat that address as a page
// and bounce to Welcome before Supabase had read it. So: remember any error,
// let Supabase read the sign-in first, tidy the address, and only then start the app.
function errorFromAddress() {
  const parts = [window.location.search.replace(/^\?/, ''), window.location.hash.replace(/^#\/?/, '')]
  for (const raw of parts) {
    const params = new URLSearchParams(raw)
    const message = params.get('error_description') || params.get('error')
    if (message) return message
  }
  return ''
}

function tidyAddress() {
  const { pathname, search, hash } = window.location
  const dirty = /access_token=|refresh_token=|error=|error_description=/.test(search + hash)
  if (dirty) window.history.replaceState(null, '', `${pathname}#/`)
}

function start() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <HashRouter>
        <AuthProvider>
          <ThemeProvider>
            <OAuthErrorBanner />
            <ErrorBoundary>
              <CallProvider>
                <App />
                <CallOverlay />
              </CallProvider>
            </ErrorBoundary>
          </ThemeProvider>
        </AuthProvider>
      </HashRouter>
    </React.StrictMode>
  )
}

// Inside the phone app, switch on the app-style behaviour (no text selection, no bounce, no zoom).
if (isNativeApp()) document.documentElement.classList.add('native-app')

// Inside the Android / iPhone app, catch the link Google sends the person back through.
listenForNativeSignIn()
installCrashReporter()

const returnedError = errorFromAddress()
if (returnedError) {
  try {
    sessionStorage.setItem(OAUTH_ERROR_KEY, returnedError)
  } catch {
    // ignore
  }
}

// Never leave the screen blank: start anyway after 4 seconds.
const waitForSignIn = Promise.race([
  supabase.auth.initialize().catch(() => {}),
  new Promise((resolve) => setTimeout(resolve, 4000)),
])
waitForSignIn.finally(() => {
  tidyAddress()
  start()
})
