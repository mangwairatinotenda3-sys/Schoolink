import { useSyncExternalStore } from 'react'

// Settings that belong to this phone or browser (they are not saved to your account).
// Dark mode, text size, high contrast, accent colour, wallpaper and Enter-is-send stay on the profile as before.
const KEY = 'sl_ui_prefs_v1'

export const UI_DEFAULTS = {
  bubbleStyle: 'rounded', // rounded | classic | square
  chatTextSize: 100, // percent of normal message size
  compact: false,
  tails: true,
  boldText: false,
  underlineLinks: false,
  reduceMotion: false,
  largeTargets: false,
  haptics: true,
}

const SHAPES = {
  rounded: { radius: '16px', tail: '3px' },
  classic: { radius: '10px', tail: '2px' },
  square: { radius: '4px', tail: '4px' },
}

function load() {
  let saved = {}
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch { saved = {} }
  const base = { ...UI_DEFAULTS }
  try {
    if (!('reduceMotion' in saved) && window.matchMedia('(prefers-reduced-motion: reduce)').matches) base.reduceMotion = true
  } catch { /* old browser */ }
  return { ...base, ...saved }
}

let state = load()
const listeners = new Set()

function apply(p) {
  const root = document.documentElement
  const shape = SHAPES[p.bubbleStyle] || SHAPES.rounded
  root.dataset.bold = p.boldText ? '1' : '0'
  root.dataset.links = p.underlineLinks ? '1' : '0'
  root.dataset.motion = p.reduceMotion ? 'reduce' : 'full'
  root.dataset.targets = p.largeTargets ? 'large' : 'normal'
  root.dataset.tails = p.tails ? '1' : '0'
  root.style.setProperty('--bubble-r', shape.radius)
  root.style.setProperty('--bubble-tail', shape.tail)
  root.style.setProperty('--chat-scale', String(p.chatTextSize / 100))
  root.style.setProperty('--chat-gap', p.compact ? '0.25rem' : '0.75rem')
}

function emit() {
  apply(state)
  listeners.forEach((l) => l())
}

export function getUiPrefs() { return state }

export function setUiPref(key, value) {
  if (state[key] === value) return
  state = { ...state, [key]: value }
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private mode */ }
  emit()
}

export function resetUiPrefs(keys) {
  const next = { ...state }
  ;(keys || Object.keys(UI_DEFAULTS)).forEach((k) => { next[k] = UI_DEFAULTS[k] })
  state = next
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private mode */ }
  emit()
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useUiPrefs() {
  return useSyncExternalStore(subscribe, getUiPrefs, getUiPrefs)
}

// A tiny buzz on phones that support it, unless the person turned it off.
export function haptic(ms = 10) {
  if (!state.haptics) return
  try { navigator.vibrate?.(ms) } catch { /* not supported */ }
}

apply(state)
