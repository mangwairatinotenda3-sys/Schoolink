import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '../context/AuthContext.jsx'
import { haptic } from '../lib/uiPrefs.js'
import { trackScreen } from '../lib/analytics.js'

const TAB_ROOTS = ['/chats', '/notifications', '/profile', '/saved', '/calendar']

// Makes the phone app behave like a phone app: status bar colour, the back button,
// a tap of feedback on the bottom tabs, and (if the person agreed) anonymous screen counts.
export default function NativeBridge() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const native = Capacitor.isNativePlatform()
  const pathRef = useRef(pathname)
  const lastBack = useRef(0)
  const [hint, setHint] = useState('')

  pathRef.current = pathname

  // Status bar matches the screen: dark screens get light icons.
  const dark = !!profile?.dark_mode || pathname.startsWith('/controller') || pathname.startsWith('/admin')
  useEffect(() => {
    if (!native) return
    ;(async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar')
        await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
        await StatusBar.setBackgroundColor({ color: dark ? '#0B0920' : '#FFFFFF' })
      } catch {
        // not available on this phone
      }
    })()
  }, [native, dark])

  // Back button: go back a screen; from a tab go Home; from Home press twice to leave.
  useEffect(() => {
    if (!native) return undefined
    let handle = null
    let gone = false
    ;(async () => {
      try {
        const { App } = await import('@capacitor/app')
        const h = await App.addListener('backButton', () => {
          const p = pathRef.current
          if (p === '/home' || p === '/') {
            const now = Date.now()
            if (now - lastBack.current < 2000) { App.exitApp(); return }
            lastBack.current = now
            setHint('Press back again to exit')
            setTimeout(() => setHint(''), 1800)
            return
          }
          if (TAB_ROOTS.includes(p) || window.history.length <= 1) { navigate('/home'); return }
          navigate(-1)
        })
        if (gone) h.remove()
        else handle = h
      } catch {
        // the default back behaviour still works
      }
    })()
    return () => { gone = true; handle?.remove() }
  }, [native, navigate])

  // A small tap on the bottom tabs and anything marked data-haptic.
  useEffect(() => {
    const onClick = (e) => {
      if (e.target?.closest?.('nav a, [data-haptic]')) haptic(8)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  useEffect(() => { trackScreen(pathname) }, [pathname])

  if (!hint) return null
  return (
    <div className="fixed left-0 right-0 z-[95] flex justify-center pointer-events-none" style={{ bottom: 100 }}>
      <span className="bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg">{hint}</span>
    </div>
  )
}
