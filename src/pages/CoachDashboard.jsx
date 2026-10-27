import { useEffect, useMemo, useState } from 'react'
import { Plus, Trophy, MapPin, Flag, Trash2 } from 'lucide-react'
import {
  DashHero, SectionTitle, Tabs, SearchBox, Empty, Denied, Field, Sheet, PrimaryButton, Pill, Fab, INPUT,
} from '../components/DashKit.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageSports } from '../lib/permissions.js'

const BLANK = { title: '', opponent: '', sport: '', location: '', status: 'upcoming', result: '' }

const SPORT_EMOJI = [
  ['football', '⚽'], ['soccer', '⚽'], ['netball', '🏐'], ['volleyball', '🏐'], ['rugby', '🏉'], ['cricket', '🏏'],
  ['basketball', '🏀'], ['tennis', '🎾'], ['athletic', '🏃'], ['track', '🏃'], ['swim', '🏊'], ['chess', '♟️'],
  ['hockey', '🏑'], ['golf', '⛳'], ['table tennis', '🏓'], ['boxing', '🥊'],
]

function emojiFor(sport) {
  const s = (sport || '').toLowerCase()
  const hit = SPORT_EMOJI.find(([k]) => s.includes(k))
  return hit ? hit[1] : '🏆'
}

export default function CoachDashboard() {
  const { user, profile } = useAuth()
  const [fixtures, setFixtures] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [resultFor, setResultFor] = useState(null)
  const [resultText, setResultText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    if (profile?.school_id) loadFixtures()
  }, [profile?.school_id])

  useEffect(() => {
    if (!notice) return undefined
    const t = setTimeout(() => setNotice(''), 3200)
    return () => clearTimeout(t)
  }, [notice])

  async function loadFixtures() {
    setLoading(true)
    const { data } = await supabase.from('sports_fixtures').select('*').eq('school_id', profile.school_id).order('created_at', { ascending: false })
    setFixtures(data ?? [])
    setLoading(false)
  }

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleAdd() {
    if (!form.title.trim()) {
      setError('Give the fixture a title.')
      return
    }
    setSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('sports_fixtures').insert({
      ...form,
      title: form.title.trim(),
      result: form.status === 'completed' ? form.result : '',
      school_id: profile.school_id,
      created_by: user.id,
    })
    setSaving(false)
    if (insertError) { setError(insertError.message); return }
    setForm(BLANK)
    setOpen(false)
    loadFixtures()
  }

  async function saveResult() {
    const f = resultFor
    if (!f) return
    const before = fixtures
    setFixtures((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: 'completed', result: resultText.trim() } : x)))
    setResultFor(null)
    const { data: upRows, error: upErr } = await supabase.from('sports_fixtures').update({ status: 'completed', result: resultText.trim() }).eq('id', f.id).select('id')
    if (upErr || !upRows?.length) {
      setFixtures(before)
      setNotice("Couldn't save the result. Run the dashboards SQL once, then try again.")
    }
  }

  async function reopen(f) {
    const before = fixtures
    setFixtures((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: 'upcoming', result: '' } : x)))
    const { data: upRows, error: upErr } = await supabase.from('sports_fixtures').update({ status: 'upcoming', result: '' }).eq('id', f.id).select('id')
    if (upErr || !upRows?.length) {
      setFixtures(before)
      setNotice("Couldn't change that fixture. Run the dashboards SQL once, then try again.")
    }
  }

  async function removeFixture() {
    const f = confirmDelete
    if (!f) return
    setConfirmDelete(null)
    const before = fixtures
    setFixtures((prev) => prev.filter((x) => x.id !== f.id))
    const { data: delRows, error: delErr } = await supabase.from('sports_fixtures').delete().eq('id', f.id).select('id')
    if (delErr || !delRows?.length) {
      setFixtures(before)
      setNotice("Couldn't delete that fixture. Run the dashboards SQL once, then try again.")
    }
  }

  const upcoming = fixtures.filter((f) => f.status !== 'completed')
  const done = fixtures.filter((f) => f.status === 'completed')
  const sportCount = new Set(fixtures.map((f) => (f.sport || '').trim().toLowerCase()).filter(Boolean)).size

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return fixtures.filter((f) => {
      if (tab === 'upcoming' && f.status === 'completed') return false
      if (tab === 'completed' && f.status !== 'completed') return false
      if (!q) return true
      return `${f.title} ${f.sport || ''} ${f.opponent || ''} ${f.location || ''}`.toLowerCase().includes(q)
    })
  }, [fixtures, tab, query])

  if (!canManageSports(profile)) {
    return <Denied title="Coach" text="Only the School Coach and school leadership can view this." />
  }

  return (
    <div className="app-shell">
      <div className="screen-scroll">
        <DashHero
          icon={Trophy}
          title="Sports"
          subtitle="Fixtures, matches and results"
          stats={[
            { label: 'Upcoming', value: upcoming.length },
            { label: 'Played', value: done.length },
            { label: 'Sports', value: sportCount },
          ]}
        />

        <div className="px-4 pb-32">
          <SectionTitle>Fixtures</SectionTitle>
          <SearchBox value={query} onChange={setQuery} placeholder="Search a team, sport or place" />
          <div className="mt-3">
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
                { key: 'completed', label: 'Results', count: done.length },
                { key: 'all', label: 'All', count: fixtures.length },
              ]}
            />
          </div>

          {notice ? <p className="mt-3 text-xs bg-gray-900 text-white rounded-full px-4 py-2 text-center">{notice}</p> : null}

          <div className="mt-3 space-y-2.5">
            {loading ? (
              <p className="text-center text-gray-400 py-10">Loading…</p>
            ) : shown.length === 0 ? (
              <Empty
                icon={Trophy}
                title={fixtures.length === 0 ? 'No fixtures yet' : 'Nothing here'}
                text={fixtures.length === 0 ? 'Tap Add fixture to schedule your first match.' : 'Try another tab or search.'}
              />
            ) : (
              shown.map((f) => {
                const completed = f.status === 'completed'
                return (
                  <div key={f.id} className="rounded-2xl border border-gray-100 bg-white p-3.5">
                    <div className="flex items-center gap-3">
                      <span className="w-12 h-12 rounded-2xl bg-brand-light flex items-center justify-center text-2xl shrink-0">{emojiFor(f.sport)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[15px] text-brand-navy truncate">{f.title}</p>
                        <p className="text-xs text-gray-400 truncate">{[f.sport, f.opponent ? `vs ${f.opponent}` : ''].filter(Boolean).join(' · ') || 'Fixture'}</p>
                      </div>
                      <Pill tone={completed ? 'green' : 'purple'}>{completed ? 'Played' : 'Upcoming'}</Pill>
                    </div>
                    {f.location ? (
                      <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-2.5"><MapPin size={13} className="text-brand-purple shrink-0" /> <span className="truncate">{f.location}</span></p>
                    ) : null}
                    {completed && f.result ? (
                      <p className="mt-2.5 rounded-xl bg-green-50 text-green-800 text-sm font-semibold px-3 py-2 flex items-center gap-2"><Flag size={14} /> {f.result}</p>
                    ) : null}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      {completed ? (
                        <button onClick={() => reopen(f)} className="h-9 px-3.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-600">Move back to upcoming</button>
                      ) : (
                        <button onClick={() => { setResultFor(f); setResultText('') }} className="h-9 px-3.5 rounded-full bg-brand-purple text-white text-xs font-semibold flex items-center gap-1.5"><Flag size={13} /> Record result</button>
                      )}
                      <button onClick={() => setConfirmDelete(f)} aria-label="Delete fixture" className="ml-auto w-9 h-9 rounded-full flex items-center justify-center text-gray-400"><Trash2 size={16} /></button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
      <Fab onClick={() => { setError(''); setOpen(true) }} icon={Plus} label="Add fixture" />

      <Sheet
        open={open}
        title="New fixture"
        onClose={() => setOpen(false)}
        footer={(
          <>
            {error ? <p className="text-red-500 text-sm mb-2">{error}</p> : null}
            <PrimaryButton onClick={handleAdd} busy={saving}>Save fixture</PrimaryButton>
          </>
        )}
      >
        <Field label="Title"><input value={form.title} onChange={(e) => updateForm('title', e.target.value)} placeholder="Inter-house final" className={INPUT} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sport"><input value={form.sport} onChange={(e) => updateForm('sport', e.target.value)} placeholder="Football" className={INPUT} /></Field>
          <Field label="Against"><input value={form.opponent} onChange={(e) => updateForm('opponent', e.target.value)} placeholder="Opponent" className={INPUT} /></Field>
        </div>
        <Field label="Where"><input value={form.location} onChange={(e) => updateForm('location', e.target.value)} placeholder="School grounds" className={INPUT} /></Field>
        <Field label="Status">
          <select value={form.status} onChange={(e) => updateForm('status', e.target.value)} className={INPUT}>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Already played</option>
          </select>
        </Field>
        {form.status === 'completed' ? (
          <Field label="Result"><input value={form.result} onChange={(e) => updateForm('result', e.target.value)} placeholder="Won 3-1" className={INPUT} /></Field>
        ) : null}
      </Sheet>

      <Sheet
        open={!!resultFor}
        title="Record the result"
        onClose={() => setResultFor(null)}
        footer={<PrimaryButton onClick={saveResult}>Save result</PrimaryButton>}
      >
        <p className="text-sm text-gray-500">{resultFor?.title}</p>
        <Field label="Result"><input autoFocus value={resultText} onChange={(e) => setResultText(e.target.value)} placeholder="Won 3-1" className={INPUT} /></Field>
      </Sheet>

      <Sheet
        open={!!confirmDelete}
        title="Delete this fixture?"
        onClose={() => setConfirmDelete(null)}
        footer={(
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(null)} className="flex-1 h-12 rounded-2xl border border-gray-200 font-semibold">Cancel</button>
            <button onClick={removeFixture} className="flex-1 h-12 rounded-2xl bg-red-600 text-white font-semibold">Delete</button>
          </div>
        )}
      >
        <p className="text-sm text-gray-500">{confirmDelete?.title} will be removed. This can't be undone.</p>
      </Sheet>
    </div>
  )
        }
