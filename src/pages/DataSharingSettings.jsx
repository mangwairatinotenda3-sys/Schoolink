import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bug, BarChart3, FileText, ShieldCheck, Trash2, ChevronRight } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { Section, SwitchRow } from '../components/SettingsKit.jsx'
import { crashReportsEnabled, setCrashReportsEnabled } from '../lib/crashReporter.js'
import { analyticsEnabled, setAnalyticsEnabled } from '../lib/analytics.js'

function LinkRow({ icon: Icon, label, sub, onClick, danger }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50">
      <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${danger ? 'bg-red-50' : 'bg-brand-light'}`} aria-hidden="true">
        <Icon size={18} className={danger ? 'text-red-500' : 'text-brand-purple'} />
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-[15px] font-medium ${danger ? 'text-red-500' : ''}`}>{label}</span>
        {sub ? <span className="block text-[12.5px] text-gray-400 mt-0.5">{sub}</span> : null}
      </span>
      <ChevronRight size={18} className="text-gray-300" />
    </button>
  )
}

export default function DataSharingSettings() {
  const navigate = useNavigate()
  const [crash, setCrash] = useState(crashReportsEnabled())
  const [stats, setStats] = useState(analyticsEnabled())

  return (
    <div className="app-shell">
      <BackHeader title="Data sharing and legal" />
      <div className="screen-scroll px-4 pb-10">
        <Section
          title="Help us fix problems"
          hint="Crash reports say what broke and on which screen. They never include your messages, name or email. Usage counts only record which screens are opened."
        >
          <SwitchRow id="crash" icon={Bug} label="Send crash reports" sub="Helps us find and fix bugs faster." checked={crash} onChange={(v) => { setCrash(v); setCrashReportsEnabled(v) }} />
          <SwitchRow id="stats" icon={BarChart3} label="Share anonymous usage" sub="Which screens are used. Off by default." checked={stats} onChange={(v) => { setStats(v); setAnalyticsEnabled(v) }} />
        </Section>

        <Section title="Legal">
          <LinkRow icon={ShieldCheck} label="Privacy Policy" sub="What we collect and why" onClick={() => navigate('/privacy')} />
          <LinkRow icon={FileText} label="Terms of Service" sub="The rules for using Schoolink" onClick={() => navigate('/terms')} />
        </Section>

        <Section title="Your data">
          <LinkRow icon={FileText} label="Download my data" sub="A copy of what Schoolink holds about you" onClick={() => navigate('/settings/safety')} />
          <LinkRow icon={Trash2} danger label="Delete my account" sub="Permanently remove your account and data" onClick={() => navigate('/settings/delete-account')} />
        </Section>
      </div>
    </div>
  )
}
