import { useEffect, useMemo, useState } from 'react'
import { Plus, ExternalLink, Check, RotateCcw, Trash2, Receipt, Wallet } from 'lucide-react'
import {
  DashHero, SectionTitle, Tabs, SearchBox, Empty, Denied, Field, Sheet, PrimaryButton, Pill, Bar, Fab, INPUT, money,
} from '../components/DashKit.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canManageFees } from '../lib/permissions.js'

const BLANK = { student_name: '', amount: '', term: '', status: 'pending', notes: '', payment_link: '' }

export default function BursarDashboard() {
  const { user, profile } = useAuth()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    if (profile?.school_id) loadRecords()
  }, [profile?.school_id])

  useEffect(() => {
    if (!notice) return undefined
    const t = setTimeout(() => setNotice(''), 3200)
    return () => clearTimeout(t)
  }, [notice])

  async function loadRecords() {
    setLoading(true)
    const { data } = await supabase.from('fee_records').select('*').eq('school_id', profile.school_id).order('created_at', { ascending: false })
    setRecords(data ?? [])
    setLoading(false)
  }

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleAdd() {
    if (!form.student_name.trim() || !form.amount) {
      setError('Add the student name and the amount.')
      return
    }
    setSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('fee_records').insert({
      ...form,
      student_name: form.student_name.trim(),
      amount: parseFloat(form.amount),
      school_id: profile.school_id,
      recorded_by: user.id,
    })
    setSaving(false)
    if (insertError) { setError(insertError.message); return }
    setForm(BLANK)
    setOpen(false)
    loadRecords()
  }

  async function setStatus(r, status) {
    const before = records
    setRecords((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)))
    const { data: upRows, error: upErr } = await supabase.from('fee_records').update({ status }).eq('id', r.id).select('id')
    if (upErr || !upRows?.length) {
      setRecords(before)
      setNotice("Couldn't change that record. Run the dashboards SQL once, then try again.")
    }
  }

  async function removeRecord() {
    const r = confirmDelete
    if (!r) return
    setConfirmDelete(null)
    const before = records
    setRecords((prev) => prev.filter((x) => x.id !== r.id))
    const { data: delRows, error: delErr } = await supabase.from('fee_records').delete().eq('id', r.id).select('id')
    if (delErr || !delRows?.length) {
      setRecords(before)
      setNotice("Couldn't delete that record. Run the dashboards SQL once, then try again.")
    }
  }

  const paid = records.filter((r) => r.status === 'paid')
  const pending = records.filter((r) => r.status !== 'paid')
  const totalCollected = paid.reduce((s, r) => s + Number(r.amount), 0)
  const totalPending = pending.reduce((s, r) => s + Number(r.amount), 0)
  const totalAll = totalCollected + totalPending
  const rate = totalAll > 0 ? Math.round((totalCollected / totalAll) * 100) : 0

  const byTerm = useMemo(() => {
    const map = {}
    records.forEach((r) => {
      const t = (r.term || 'No term').trim() || 'No term'
      if (!map[t]) map[t] = { term: t, paid: 0, total: 0 }
      map[t].total += Number(r.amount)
      if (r.status === 'paid') map[t].paid += Number(r.amount)
    })
    return Object.values(map).slice(0, 5)
  }, [records])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return records.filter((r) => {
      if (tab === 'paid' && r.status !== 'paid') return false
      if (tab === 'pending' && r.status === 'paid') return false
      if (!q) return true
      return `${r.student_name} ${r.term || ''} ${r.notes || ''}`.toLowerCase().includes(q)
    })
  }, [records, tab, query])

  if (!canManageFees(profile)) {
    return <Denied title="Bursar" text="Only the Bursar and school leadership can view this." />
  }

  return (
    <div className="app-shell">
      <div className="screen-scroll">
        <DashHero
          icon={Wallet}
          title="Bursar"
          subtitle="School fees and payments"
          stats={[
            { label: 'Collected', value: money(totalCollected) },
            { label: 'Pending', value: money(totalPending) },
            { label: 'Paid', value: `${rate}%` },
          ]}
        />

        <div className="px-4 pb-32">
          <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-brand-navy">Fees collected</p>
              <p className="text-sm font-bold text-brand-purple tabular-nums">{rate}%</p>
            </div>
            <Bar value={totalCollected} max={totalAll} tone="#16A34A" />
            <p className="text-xs text-gray-400 mt-2">{money(totalCollected)} of {money(totalAll)} recorded</p>
          </div>

          {byTerm.length > 1 ? (
            <>
              <SectionTitle>By term</SectionTitle>
              <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3.5">
                {byTerm.map((t) => (
                  <div key={t.term}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-brand-navy truncate pr-3">{t.term}</p>
                      <p className="text-xs text-gray-500 tabular-nums shrink-0">{money(t.paid)} / {money(t.total)}</p>
                    </div>
                    <Bar value={t.paid} max={t.total} tone="#16A34A" />
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <SectionTitle>Records</SectionTitle>
          <SearchBox value={query} onChange={setQuery} placeholder="Search a student or term" />
          <div className="mt-3">
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { key: 'all', label: 'All', count: records.length },
                { key: 'pending', label: 'Pending', count: pending.length },
                { key: 'paid', label: 'Paid', count: paid.length },
              ]}
            />
          </div>

          {notice ? <p className="mt-3 text-xs bg-gray-900 text-white rounded-full px-4 py-2 text-center">{notice}</p> : null}

          <div className="mt-3 space-y-2.5">
            {loading ? (
              <p className="text-center text-gray-400 py-10">Loading…</p>
            ) : shown.length === 0 ? (
              <Empty
                icon={Receipt}
                title={records.length === 0 ? 'No fee records yet' : 'Nothing matches'}
                text={records.length === 0 ? 'Tap Add record to log the first payment.' : 'Try another search or filter.'}
              />
            ) : (
              shown.map((r) => {
                const isPaid = r.status === 'paid'
                return (
                  <div key={r.id} className="rounded-2xl border border-gray-100 bg-white p-3.5">
                    <div className="flex items-center gap-3">
                      <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-extrabold ${isPaid ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                        {(r.student_name || '?').slice(0, 1).toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[15px] text-brand-navy truncate">{r.student_name}</p>
                        <p className="text-xs text-gray-400 truncate">{[r.term, r.notes].filter(Boolean).join(' · ') || 'Fee'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-extrabold text-[15px] text-brand-navy tabular-nums">{money(r.amount)}</p>
                        <Pill tone={isPaid ? 'green' : 'amber'} className="mt-1">{isPaid ? 'Paid' : 'Pending'}</Pill>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      {isPaid ? (
                        <button onClick={() => setStatus(r, 'pending')} className="h-9 px-3.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 flex items-center gap-1.5"><RotateCcw size={13} /> Mark pending</button>
                      ) : (
                        <button onClick={() => setStatus(r, 'paid')} className="h-9 px-3.5 rounded-full bg-green-600 text-white text-xs font-semibold flex items-center gap-1.5"><Check size={14} /> Mark paid</button>
                      )}
                      {r.payment_link ? (
                        <a href={r.payment_link} target="_blank" rel="noreferrer" className="h-9 px-3.5 rounded-full border border-brand-purple text-brand-purple text-xs font-semibold flex items-center gap-1.5"><ExternalLink size={13} /> Pay link</a>
                      ) : null}
                      <button onClick={() => setConfirmDelete(r)} aria-label="Delete record" className="ml-auto w-9 h-9 rounded-full flex items-center justify-center text-gray-400"><Trash2 size={16} /></button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

      </div>
      <Fab onClick={() => { setError(''); setOpen(true) }} icon={Plus} label="Add record" />

      <Sheet
        open={open}
        title="New fee record"
        onClose={() => setOpen(false)}
        footer={(
          <>
            {error ? <p className="text-red-500 text-sm mb-2">{error}</p> : null}
            <PrimaryButton onClick={handleAdd} busy={saving}>Save record</PrimaryButton>
          </>
        )}
      >
        <Field label="Student name"><input value={form.student_name} onChange={(e) => updateForm('student_name', e.target.value)} placeholder="e.g. Tendai Moyo" className={INPUT} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount ($)"><input value={form.amount} onChange={(e) => updateForm('amount', e.target.value)} type="number" inputMode="decimal" placeholder="0.00" className={INPUT} /></Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => updateForm('status', e.target.value)} className={INPUT}>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
          </Field>
        </div>
        <Field label="Term"><input value={form.term} onChange={(e) => updateForm('term', e.target.value)} placeholder="Term 1 2026" className={INPUT} /></Field>
        <Field label="Notes (optional)"><input value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} placeholder="Part payment, uniform, trip…" className={INPUT} /></Field>
        <Field label="Payment link (optional)" hint="A Stripe or PayPal link parents can open."><input value={form.payment_link} onChange={(e) => updateForm('payment_link', e.target.value)} placeholder="https://" className={INPUT} /></Field>
      </Sheet>

      <Sheet
        open={!!confirmDelete}
        title="Delete this record?"
        onClose={() => setConfirmDelete(null)}
        footer={(
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(null)} className="flex-1 h-12 rounded-2xl border border-gray-200 font-semibold">Cancel</button>
            <button onClick={removeRecord} className="flex-1 h-12 rounded-2xl bg-red-600 text-white font-semibold">Delete</button>
          </div>
        )}
      >
        <p className="text-sm text-gray-500">
          {confirmDelete ? `${confirmDelete.student_name} · ${money(confirmDelete.amount)}` : ''} will be removed. This can't be undone.
        </p>
      </Sheet>
    </div>
  )
  }
