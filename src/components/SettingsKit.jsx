import { haptic } from '../lib/uiPrefs.js'

const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-')

export function Section({ title, hint, children }) {
  return (
    <section className="mt-7">
      {title ? <h2 className="px-1 pb-2 text-[12px] font-semibold uppercase tracking-wide text-gray-400">{title}</h2> : null}
      <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden divide-y divide-gray-100">{children}</div>
      {hint ? <p className="px-1 pt-2 text-[12.5px] leading-snug text-gray-400">{hint}</p> : null}
    </section>
  )
}

// The whole row is the switch, so it is easy to hit and screen readers say "label, switch, on/off".
export function SwitchRow({ icon: Icon, label, sub, checked, onChange, id }) {
  const subId = `${id}-sub`
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-describedby={sub ? subId : undefined}
      onClick={() => { haptic(8); onChange(!checked) }}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50"
    >
      {Icon ? <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0" aria-hidden="true"><Icon size={18} className="text-brand-purple" /></span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
        {sub ? <span id={subId} className="block text-[12.5px] leading-snug text-gray-400 mt-0.5">{sub}</span> : null}
      </span>
      <span className="sl-switch" data-on={checked ? '1' : '0'} aria-hidden="true"><span className="sl-switch-knob" /></span>
    </button>
  )
}

export function Segment({ label, options, value, onChange }) {
  return (
    <div className="px-4 py-3.5">
      <p id={`seg-${slug(label)}`} className="text-[15px] font-medium mb-2.5">{label}</p>
      <div role="radiogroup" aria-labelledby={`seg-${slug(label)}`} className="flex p-1 rounded-xl bg-gray-100">
        {options.map((o) => {
          const on = value === o.id
          return (
            <button
              key={o.id}
              role="radio"
              aria-checked={on}
              onClick={() => { haptic(8); onChange(o.id) }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13.5px] font-semibold transition-colors ${on ? 'bg-white shadow-sm text-brand-purple' : 'text-gray-500'}`}
            >
              {o.icon ? <o.icon size={15} aria-hidden="true" /> : null}{o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// A slider that snaps to named steps, e.g. Small / Default / Large.
export function StepSlider({ label, steps, index, onChange }) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={`step-${slug(label)}`} className="text-[15px] font-medium">{label}</label>
        <span className="text-[13px] font-semibold text-brand-purple" aria-hidden="true">{steps[index]}</span>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <span className="text-[12px] font-semibold text-gray-400" aria-hidden="true">Aa</span>
        <input
          id={`step-${slug(label)}`}
          type="range"
          min={0}
          max={steps.length - 1}
          step={1}
          value={index}
          onChange={(e) => { const v = Number(e.target.value); if (v !== index) { haptic(6); onChange(v) } }}
          aria-valuetext={steps[index]}
          className="flex-1 h-8"
          style={{ accentColor: 'var(--brand-purple)' }}
        />
        <span className="text-[22px] font-semibold text-gray-400 leading-none" aria-hidden="true">Aa</span>
      </div>
      <div className="flex justify-between px-7 mt-0.5" aria-hidden="true">
        {steps.map((s, i) => <span key={s} className={`text-[10.5px] ${i === index ? 'text-brand-purple font-semibold' : 'text-gray-400'}`}>{s}</span>)}
      </div>
    </div>
  )
}

export function ResetButton({ onClick, children }) {
  return (
    <button onClick={onClick} className="mt-8 w-full rounded-2xl border border-gray-200 py-3.5 text-[15px] font-semibold text-gray-600 active:bg-gray-50">
      {children}
    </button>
  )
      }
