import { useState } from 'react'
import { Check, CornerDownRight, Rows3, CornerDownLeft } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { Section, SwitchRow, Segment, StepSlider, ResetButton } from '../components/SettingsKit.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { wallpapers, wallpaperStyle } from '../lib/chatPrefs.js'
import { useUiPrefs, setUiPref, resetUiPrefs, haptic } from '../lib/uiPrefs.js'

const DEFAULT_COLOR = '#6C4CE0'
const colors = [
  { name: 'Default Purple', color: '#6C4CE0' },
  { name: 'Ocean Blue', color: '#2563EB' },
  { name: 'Indigo', color: '#4F46E5' },
  { name: 'Teal', color: '#0F766E' },
  { name: 'Forest Green', color: '#059669' },
  { name: 'Sunset Orange', color: '#EA580C' },
  { name: 'Rose Pink', color: '#DB2777' },
  { name: 'Crimson', color: '#DC2626' },
]
const textSteps = [{ label: 'Small', value: 90 }, { label: 'Default', value: 100 }, { label: 'Large', value: 115 }, { label: 'Huge', value: 130 }]
const CHAT_KEYS = ['bubbleStyle', 'chatTextSize', 'compact', 'tails']

// What your chats will look like, updating live as you change things below.
function Preview({ wallpaper }) {
  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden" style={wallpaperStyle(wallpaper)} aria-hidden="true">
      <div className="px-3 py-4 chat-surface flex flex-col">
        <div className="flex justify-start"><div className="max-w-[75%] px-4 py-2 chat-bubble theirs bg-gray-100 text-brand-navy">Did you finish the homework? 📚</div></div>
        <div className="flex justify-end"><div className="max-w-[75%] px-4 py-2 chat-bubble bg-brand-purple text-white">Yes! Want to study together?<span className="block text-right text-[10px] opacity-70 mt-1">10:24</span></div></div>
        <div className="flex justify-end"><div className="max-w-[75%] px-4 py-2 chat-bubble mine bg-brand-purple text-white">I'll bring my notes<span className="block text-right text-[10px] opacity-70 mt-1">10:24</span></div></div>
        <div className="flex justify-start"><div className="max-w-[75%] px-4 py-2 chat-bubble theirs bg-gray-100 text-brand-navy">See you at break!</div></div>
      </div>
    </div>
  )
}

export default function ChatAppearanceSettings() {
  const { profile, saveProfileDetails } = useAuth()
  const ui = useUiPrefs()
  const [color, setColor] = useState(profile?.theme_color || DEFAULT_COLOR)
  const [wallpaper, setWallpaper] = useState(profile?.chat_wallpaper || 'default')
  const [enterToSend, setEnterToSend] = useState(profile?.chat_enter_to_send ?? true)
  const [note, setNote] = useState('')

  function say(text) {
    setNote(text)
    setTimeout(() => setNote(''), 1800)
  }

  async function save(updates) {
    const { error } = await saveProfileDetails(updates)
    say(error ? "Couldn't save. Check your connection." : 'Saved')
  }

  function pickColor(c) {
    haptic(8)
    setColor(c)
    document.documentElement.style.setProperty('--brand-purple', c)
    save({ theme_color: c })
  }

  function pickWallpaper(key) {
    haptic(8)
    setWallpaper(key)
    save({ chat_wallpaper: key })
  }

  function changeEnter(v) {
    setEnterToSend(v)
    save({ chat_enter_to_send: v })
  }

  function resetAll() {
    resetUiPrefs(CHAT_KEYS)
    setColor(DEFAULT_COLOR)
    setWallpaper('default')
    document.documentElement.style.setProperty('--brand-purple', DEFAULT_COLOR)
    save({ theme_color: DEFAULT_COLOR, chat_wallpaper: 'default' })
  }

  const sizeIndex = Math.max(0, textSteps.findIndex((s) => s.value === ui.chatTextSize))

  return (
    <div className="app-shell">
      <BackHeader title="Chat appearance" />
      <div className="screen-scroll px-4 pb-10">
        <div className="mt-3"><Preview wallpaper={wallpaper} /></div>
        <p className="h-5 text-center text-[12.5px] text-green-600 mt-1.5" role="status" aria-live="polite">{note}</p>

        <Section title="Accent colour" hint="Colours your sent messages, buttons and highlights. Saves as soon as you tap one.">
          <div className="px-4 py-4">
            <div role="radiogroup" aria-label="Accent colour" className="grid grid-cols-4 gap-y-4 justify-items-center">
              {colors.map((c) => {
                const on = color.toLowerCase() === c.color.toLowerCase()
                return (
                  <button
                    key={c.color}
                    role="radio"
                    aria-checked={on}
                    aria-label={c.name}
                    onClick={() => pickColor(c.color)}
                    className="w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-90"
                    style={{ backgroundColor: c.color, boxShadow: on ? `0 0 0 3px var(--surface, #fff), 0 0 0 5px ${c.color}` : 'none' }}
                  >
                    {on ? <Check size={20} strokeWidth={3} className="text-white" aria-hidden="true" /> : null}
                  </button>
                )
              })}
            </div>
          </div>
        </Section>

        <Section title="Wallpaper" hint="Shows behind messages in your chats and groups.">
          <div className="px-4 py-4">
            <div role="radiogroup" aria-label="Chat wallpaper" className="grid grid-cols-4 gap-3">
              {wallpapers.map((w) => {
                const on = wallpaper === w.key
                return (
                  <button key={w.key} role="radio" aria-checked={on} onClick={() => pickWallpaper(w.key)} className="flex flex-col items-center gap-1.5">
                    <span
                      className={`relative w-full rounded-xl border-2 overflow-hidden ${on ? 'border-brand-purple' : 'border-gray-200'}`}
                      style={{ aspectRatio: '3 / 4', ...(w.key === 'default' ? {} : w.style) }}
                    >
                      <span className="absolute left-1.5 top-2.5 h-2 w-1/2 rounded bg-gray-400/40" />
                      <span className="absolute right-1.5 top-6 h-2 w-1/2 rounded bg-brand-purple" />
                      <span className="absolute left-1.5 top-10 h-2 w-2/5 rounded bg-gray-400/40" />
                      {on ? <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-brand-purple flex items-center justify-center"><Check size={12} strokeWidth={3} className="text-white" /></span> : null}
                    </span>
                    <span className={`text-[11px] ${on ? 'text-brand-purple font-semibold' : 'text-gray-500'}`}>{w.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </Section>

        <Section title="Messages">
          <Segment
            label="Bubble shape"
            value={ui.bubbleStyle}
            onChange={(v) => setUiPref('bubbleStyle', v)}
            options={[{ id: 'rounded', label: 'Rounded' }, { id: 'classic', label: 'Classic' }, { id: 'square', label: 'Square' }]}
          />
          <StepSlider label="Message text size" steps={textSteps.map((s) => s.label)} index={sizeIndex} onChange={(i) => setUiPref('chatTextSize', textSteps[i].value)} />
          <SwitchRow id="tails" icon={CornerDownRight} label="Message tails" sub="A sharper corner on the side the message came from." checked={ui.tails} onChange={(v) => setUiPref('tails', v)} />
          <SwitchRow id="compact" icon={Rows3} label="Compact spacing" sub="Less space between messages, so more fit on screen." checked={ui.compact} onChange={(v) => setUiPref('compact', v)} />
        </Section>

        <Section title="Typing">
          <SwitchRow id="enter" icon={CornerDownLeft} label="Enter is send" sub="Pressing Enter sends your message. Turn off to send only with the send button." checked={enterToSend} onChange={changeEnter} />
        </Section>

        <ResetButton onClick={resetAll}>Reset chat appearance</ResetButton>
      </div>
    </div>
  )
   }
