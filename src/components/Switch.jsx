import { haptic } from '../lib/uiPrefs.js'

// The toggle used everywhere. Drop-in for the old local Toggle: <Toggle checked={x} onChange={setX} />
// The knob is placed with explicit left/top (the old one was centred by the button, so it sat in the wrong spot).
export default function Switch({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      disabled={disabled}
      data-on={checked ? '1' : '0'}
      onClick={() => { haptic(8); onChange(!checked) }}
      className="sl-switch disabled:opacity-40"
    >
      <span className="sl-switch-knob" />
    </button>
  )
    }
