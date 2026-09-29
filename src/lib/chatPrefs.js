// Shared helpers for the Settings > Chat Appearance / Notifications /
// Storage and Data screens, and for the chat screens that apply them.

export const wallpapers = [
  { key: 'default', name: 'Default', style: {} },
  { key: 'lavender', name: 'Lavender', style: { background: '#F3EFFF' } },
  { key: 'mint', name: 'Mint', style: { background: '#E8F7F0' } },
  { key: 'sky', name: 'Sky', style: { background: '#E8F1FD' } },
  { key: 'peach', name: 'Peach', style: { background: '#FFF0E6' } },
  { key: 'sunset', name: 'Sunset', style: { background: 'linear-gradient(180deg, #FDE7F3, #E8E4FF)' } },
  {
    key: 'dots',
    name: 'Dots',
    style: { backgroundColor: '#F7F7FB', backgroundImage: 'radial-gradient(#D9D4F0 1px, transparent 1px)', backgroundSize: '16px 16px' },
  },
  { key: 'night', name: 'Night', style: { background: '#1A1533' } },
]

export function wallpaperStyle(key) {
  return (wallpapers.find((w) => w.key === key) || wallpapers[0]).style
}

export const tones = [
  { key: 'default', name: 'Default' },
  { key: 'chime', name: 'Chime' },
  { key: 'ping', name: 'Ping' },
  { key: 'soft', name: 'Soft' },
  { key: 'silent', name: 'Silent' },
]

const toneNotes = {
  default: [880],
  chime: [523.25, 659.25, 783.99],
  ping: [1046.5],
  soft: [440, 554.37],
}

// Plays a short synthesized tone (no audio files needed). Browsers only allow
// sound after the person has interacted with the page, which is always true
// once they're inside a chat, so this is safe to call from a realtime handler.
export function playTone(tone) {
  if (!tone || tone === 'silent') return
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const notes = toneNotes[tone] || toneNotes.default
    notes.forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.12
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.15, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.3)
    })
    setTimeout(() => ctx.close?.(), 800)
  } catch {
    // Audio blocked or unsupported — stay silent rather than error.
  }
}

// pref is 'wifi' | 'always' | 'never'. Where the browser can't tell us what
// kind of connection this is (iOS Safari, most desktop browsers), "Wi-Fi only"
// falls back to loading, since guessing wrong would hide media for no reason.
export function shouldAutoLoadMedia(pref) {
  if (pref === 'always') return true
  if (pref === 'never') return false
  const c = typeof navigator !== 'undefined' ? navigator.connection : null
  if (!c) return true
  if (c.saveData) return false
  if (c.type) return c.type === 'wifi' || c.type === 'ethernet'
  return true
  }
