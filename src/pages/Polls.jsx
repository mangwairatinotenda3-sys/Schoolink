import { useEffect, useState } from 'react'
import { Plus, X, BarChart3 } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

function PollCard({ poll, userId }) {
  const [options, setOptions] = useState([])
  const [votes, setVotes] = useState({})
  const [myVotes, setMyVotes] = useState(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOptions()
  }, [])

  async function loadOptions() {
    const { data: opts } = await supabase.from('poll_options').select('*').eq('poll_id', poll.id)
    setOptions(opts ?? [])

    const { data: allVotes } = await supabase.from('poll_votes').select('*').eq('poll_id', poll.id)
    const counts = {}
    const mine = new Set()
    for (const v of allVotes ?? []) {
      counts[v.option_id] = (counts[v.option_id] ?? 0) + 1
      if (v.user_id === userId) mine.add(v.option_id)
    }
    setVotes(counts)
    setMyVotes(mine)
    setLoading(false)
  }

  async function handleVote(optionId) {
    if (poll.status !== 'open') return
    if (myVotes.has(optionId)) {
      await supabase.from('poll_votes').delete().eq('poll_id', poll.id).eq('option_id', optionId).eq('user_id', userId)
      setMyVotes((prev) => {
        const next = new Set(prev)
        next.delete(optionId)
        return next
      })
      setVotes((prev) => ({ ...prev, [optionId]: (prev[optionId] ?? 1) - 1 }))
      return
    }
    if (!poll.allow_multiple && myVotes.size > 0) {
      const previousOptionId = [...myVotes][0]
      await supabase.from('poll_votes').delete().eq('poll_id', poll.id).eq('option_id', previousOptionId).eq('user_id', userId)
      setVotes((prev) => ({ ...prev, [previousOptionId]: (prev[previousOptionId] ?? 1) - 1 }))
    }
    await supabase.from('poll_votes').insert({ poll_id: poll.id, option_id: optionId, user_id: userId })
    setMyVotes((prev) => {
      const next = poll.allow_multiple ? new Set(prev) : new Set()
      next.add(optionId)
      return next
    })
    setVotes((prev) => ({ ...prev, [optionId]: (prev[optionId] ?? 0) + 1 }))
  }

  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0)

  return (
    <div className="border border-gray-100 rounded-xl p-4">
      <p className="font-semibold text-sm">{poll.question}</p>
      <p className="text-xs text-gray-400 mb-3">
        {poll.status === 'open' ? 'Open · ' : 'Closed · '}{totalVotes} vote{totalVotes !== 1 ? 's' : ''}
      </p>
      {loading ? (
        <p className="text-xs text-gray-400">Loading options…</p>
      ) : (
        <div className="space-y-2">
          {options.map((o) => {
            const count = votes[o.id] ?? 0
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
            const selected = myVotes.has(o.id)
            return (
              <button
                key={o.id}
                onClick={() => handleVote(o.id)}
                disabled={poll.status !== 'open'}
                className={`w-full text-left relative overflow-hidden rounded-lg border ${
                  selected ? 'border-brand-purple' : 'border-gray-200'
                } disabled:opacity-70`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-brand-light"
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center justify-between px-3 py-2 text-sm">
                  <span className={selected ? 'font-medium text-brand-purple' : 'text-gray-700'}>{o.option_text}</span>
                  <span className="text-xs text-gray-400">{pct}%</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Polls() {
  const { user, profile } = useAuth()
  const [polls, setPolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [question, setQuestion] = useState('')
  const [optionInputs, setOptionInputs] = useState(['', ''])
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canCreate = profile?.role && profile.role !== 'Student'

  useEffect(() => {
    if (profile?.school_id) loadPolls()
  }, [profile?.school_id])

  async function loadPolls() {
    setLoading(true)
    const { data } = await supabase
      .from('polls')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false })
    setPolls(data ?? [])
    setLoading(false)
  }

  function updateOption(index, value) {
    setOptionInputs((prev) => prev.map((o, i) => (i === index ? value : o)))
  }

  function addOptionField() {
    setOptionInputs((prev) => [...prev, ''])
  }

  async function handleCreate() {
    const cleanOptions = optionInputs.map((o) => o.trim()).filter(Boolean)
    if (!question.trim() || cleanOptions.length < 2) {
      setError('Add a question and at least 2 options.')
      return
    }
    setSaving(true)
    setError('')

    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .insert({ school_id: profile.school_id, question, allow_multiple: allowMultiple, created_by: user.id })
      .select()
      .maybeSingle()

    if (pollError) {
      setError(pollError.message)
      setSaving(false)
      return
    }

    await supabase.from('poll_options').insert(cleanOptions.map((option_text) => ({ poll_id: poll.id, option_text })))

    setSaving(false)
    setQuestion('')
    setOptionInputs(['', ''])
    setAllowMultiple(false)
    setShowForm(false)
    loadPolls()
  }

  return (
    <div className="app-shell">
      <BackHeader title="Polls & Surveys" />

      {canCreate ? (
        <div className="px-4 pt-2">
          {showForm ? (
            <div className="border border-gray-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Create Poll</p>
                <button onClick={() => setShowForm(false)}>
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
              />
              {optionInputs.map((opt, i) => (
                <input
                  key={i}
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple"
                />
              ))}
              <button onClick={addOptionField} className="text-xs text-brand-purple font-medium">
                + Add another option
              </button>
              <label className="flex items-center gap-2 text-sm text-gray-600 pt-1">
                <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} />
                Allow selecting multiple options
              </label>
              {error ? <p className="text-red-500 text-xs">{error}</p> : null}
              <button
                onClick={handleCreate}
                disabled={saving}
                className="w-full bg-brand-purple text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60"
              >
                {saving ? 'Creating…' : 'Create Poll'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
            >
              <Plus size={16} /> Create Poll
            </button>
          )}
        </div>
      ) : null}

      <div className="screen-scroll px-4 pt-3 space-y-3">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">Loading…</p>
        ) : polls.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            <BarChart3 size={28} className="mx-auto mb-2 text-gray-300" />
            <p>No polls yet.</p>
          </div>
        ) : (
          polls.map((poll) => <PollCard key={poll.id} poll={poll} userId={user.id} />)
        )}
      </div>
      <BottomNav />
    </div>
  )
    }
