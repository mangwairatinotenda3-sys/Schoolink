import { useState } from 'react'
import { Sun, Moon, Check, Eye, Bold, Underline, Zap, Hand, Vibrate } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { Section, SwitchRow, StepSlider, ResetButton } from '../components/SettingsKit.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useUiPrefs, setUiPref, resetUiPrefs, haptic } from '../lib/uiPrefs.js'

const sizes = ['Small', 'Default', 'Large', 'Extra Large']
const A11Y_KEYS = ['boldText', 'underlineLinks', 'reduceMotion', 'largeTargets', 'haptics']

// A little phone drawing for each colour mode.
function ModeCard({ dark, selected, onSelect }) {
  const bg = dark ? '#0B0920' : '#FFFFFF'
  const line = dark ? '#2B2748' : '#ECEAF3'
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={() => { haptic(8); onSelect() }}
      className={`flex-1 rounded-2xl border-2 p-3 text-left transition-colors ${selected ? 'border-brand-purple' : 'border-gray-200'}`}
    >
      <span className="block rounded-xl overflow-hidden border" style={{ background: bg, borderColor: line }} aria-hidden="true">
        <span className="block h-4" style={{ background: dark ? '#100D25' : '#F5F4FB' }} />
        <span className="block px-2 py-2 space-y-1.5">
          <span className="block h-2 w-3/4 rounded" style={{ background: line }} />
          <span className="block h-2 w-1/2 rounded bg-brand-purple" />
          <span className="block h-2 w-2/3 rounded" style={{ background: line }} />
        </span>
      </span>
      <span className="flex items-center justify-between mt-2.5">
        <span className="flex items-center gap-1.5 text-[14px] font-semibold">{dark ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}{dark ? 'Dark' : 'Light'}</span>
        <span className={`w-5 h-5 rounded-full flex items-center justify-center ${selected ? 'bg-brand-purple' : 'border-2 border-gray-300'}`}>
          {selected ? <Check size={12} strokeWidth={3} className="text-white" aria-hidden="true" /> : null}
        </span>
      </span>
    </button>
  )
}

export default function AccessibilitySettings() {
  const { profile, saveProfileDetails } = useAuth()
  const ui = useUiPrefs()
  const [textSize, setTextSize] = useState((profile?.text_size || 'default').toLowerCase())
  const [darkMode, setDarkMode] = useState(profile?.dark_mode ?? false)
  const [highContrast, setHighContrast] = useState(profile?.high_contrast ?? false)

  const sizeIndex = Math.max(0, sizes.findIndex((s) => s.toLowerCase() === textSize))

  async function handleTextSize(i) {
    const key = sizes[i].toLowerCase()
    setTextSize(key)
    await saveProfileDetails({ text_size: key })
  }

  async function handleDarkMode(value) {
    setDarkMode(value)
    await saveProfileDetails({ dark_mode: value })
  }

  async function handleHighContrast(value) {
    setHighContrast(value)
    await saveProfileDetails({ high_contrast: value })
  }

  function resetAll() {
    resetUiPrefs(A11Y_KEYS)
    setTextSize('default')
    setHighContrast(false)
    saveProfileDetails({ text_size: 'default', high_contrast: false })
  }

  return (
    <div className="app-shell">
      <BackHeader title="Accessibility" />
      <div className="screen-scroll px-4 pb-10">
        <Section title="Appearance">
          <div className="p-3">
            <div role="radiogroup" aria-label="Colour mode" className="flex gap-3">
              <ModeCard dark={false} selected={!darkMode} onSelect={() => handleDarkMode(false)} />
              <ModeCard dark selected={darkMode} onSelect={() => handleDarkMode(true)} />
            </div>
          </div>
        </Section>

        <Section title="Text size" hint="Changes the size of text everywhere in Schoolink. Chat message size is in Chat appearance.">
          <StepSlider label="App text size" steps={sizes} index={sizeIndex} onChange={handleTextSize} />
          <div className="px-4 pb-4">
            <p className="rounded-xl bg-gray-50 px-3.5 py-3 text-[15px] leading-snug">Homework is due on Friday. Bring your notebook and a pen.</p>
          </div>
        </Section>

        <Section title="Vision">
          <SwitchRow id="contrast" icon={Eye} label="High contrast" sub="Sharper colours for better readability." checked={highContrast} onChange={handleHighContrast} />
          <SwitchRow id="bold" icon={Bold} label="Bold text" sub="Makes all text heavier so it is easier to read." checked={ui.boldText} onChange={(v) => setUiPref('boldText', v)} />
          <SwitchRow id="links" icon={Underline} label="Underline links" sub="Links are underlined, not just coloured." checked={ui.underlineLinks} onChange={(v) => setUiPref('underlineLinks', v)} />
        </Section>

        <Section title="Motion">
          <SwitchRow id="motion" icon={Zap} label="Reduce motion" sub="Turns off sliding, fading and bouncing animations." checked={ui.reduceMotion} onChange={(v) => setUiPref('reduceMotion', v)} />
        </Section>

        <Section title="Touch">
          <SwitchRow id="targets" icon={Hand} label="Larger tap targets" sub="Buttons are at least 44 px tall and wide, easier to hit." checked={ui.largeTargets} onChange={(v) => setUiPref('largeTargets', v)} />
          <SwitchRow id="haptics" icon={Vibrate} label="Vibration feedback" sub="A tiny buzz when you switch things on or off." checked={ui.haptics} onChange={(v) => setUiPref('haptics', v)} />
        </Section>

        <ResetButton onClick={resetAll}>Reset accessibility</ResetButton>
      </div>
    </div>
  )
}
