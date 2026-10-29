import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// Shared layout and controls for every sign-in and onboarding screen.
export function AuthPage({ title, subtitle, back = true, onBack, children, footer }) {
  const navigate = useNavigate()
  return (
    <div className="app-shell">
      <div className="screen-scroll px-6 pb-10">
        <div className="pt-3 h-12 flex items-center -ml-2">
          {back ? (
            <button
              type="button"
              onClick={onBack || (() => navigate(-1))}
              aria-label="Back"
              className="w-10 h-10 rounded-full flex items-center justify-center text-brand-navy active:bg-gray-100"
            >
              <ChevronLeft size={24} />
            </button>
          ) : null}
        </div>
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight text-brand-navy">{title}</h1>
        {subtitle ? <p className="mt-2 text-[15px] leading-relaxed text-gray-500">{subtitle}</p> : null}
        <div className="mt-7">{children}</div>
        {footer ? <div className="mt-8">{footer}</div> : null}
      </div>
    </div>
  )
}

export function AuthField({ label, icon: Icon, error, hint, right, ...input }) {
  return (
    <div>
      <label htmlFor={input.id} className="block text-[13px] font-semibold text-brand-navy mb-1.5">{label}</label>
      <div
        className={`flex items-center gap-3 h-14 rounded-2xl border bg-white px-4 focus-within:border-brand-purple focus-within:ring-4 focus-within:ring-brand-purple/10 ${
          error ? 'border-red-300' : 'border-gray-200'
        }`}
      >
        {Icon ? <Icon size={18} className="text-gray-400 shrink-0" /> : null}
        <input
          {...input}
          className="flex-1 min-w-0 h-full bg-transparent outline-none text-[15px] text-brand-navy placeholder:text-gray-400"
        />
        {right}
      </div>
      {error ? <p className="mt-1.5 text-xs text-red-500">{error}</p> : hint ? <p className="mt-1.5 text-xs text-gray-400">{hint}</p> : null}
    </div>
  )
}

export function PrimaryButton({ busy = false, busyLabel = 'Please wait…', children, className = '', ...rest }) {
  return (
    <button
      {...rest}
      disabled={busy || rest.disabled}
      className={`w-full h-14 rounded-2xl bg-brand-purple text-white text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 ${className}`}
    >
      {busy ? busyLabel : children}
    </button>
  )
}

export function Segmented({ value, options, onChange }) {
  return (
    <div role="tablist" className="grid grid-cols-2 p-1 rounded-2xl bg-gray-100">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-10 rounded-xl text-sm font-semibold ${value === o.value ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-500'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const NOTICE_TONES = {
  error: 'bg-red-50 text-red-600 border-red-100',
  ok: 'bg-green-50 text-green-700 border-green-100',
  info: 'bg-brand-light text-brand-navy border-brand-purple/20',
}

export function Notice({ tone = 'error', children }) {
  return <div role="alert" className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${NOTICE_TONES[tone]}`}>{children}</div>
}

export function OptionCard({ icon: Icon, title, sub, selected = false, radio = false, disabled = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left flex items-center gap-4 rounded-2xl border bg-white px-4 py-4 disabled:opacity-50 ${
        selected ? 'border-brand-purple ring-4 ring-brand-purple/10' : 'border-gray-200'
      }`}
    >
      {Icon ? (
        <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${selected ? 'bg-brand-purple text-white' : 'bg-brand-light text-brand-purple'}`}>
          <Icon size={20} />
        </span>
      ) : null}
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-brand-navy">{title}</span>
        {sub ? <span className="block text-[13px] leading-snug text-gray-500 mt-0.5">{sub}</span> : null}
      </span>
      {radio ? (
        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'border-brand-purple' : 'border-gray-300'}`}>
          {selected ? <span className="w-2.5 h-2.5 rounded-full bg-brand-purple" /> : null}
        </span>
      ) : null}
    </button>
  )
}

// Invite codes: typed in capitals, spaces removed, shown large and centred.
export function CodeInput({ value, onChange, ...rest }) {
  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase().replace(/\s/g, ''))}
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
      className="w-full h-16 rounded-2xl border border-gray-200 bg-white text-center font-mono text-2xl font-bold tracking-[0.3em] text-brand-navy placeholder:text-gray-300 outline-none focus:border-brand-purple focus:ring-4 focus:ring-brand-purple/10"
    />
  )
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
