import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ShieldCheck, Clock, KeyRound } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function AccountSettings() {
  const navigate = useNavigate()
  const { user, profile, saveProfileDetails, signOut } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const isEmailAccount = user?.app_metadata?.provider === 'email'

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMessage, setPwMessage] = useState('')
  const [pwError, setPwError] = useState('')

  async function handleSave() {
    setSaving(true)
    await saveProfileDetails({ full_name: fullName, phone })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleChangePassword() {
    setPwError('')
    setPwMessage('')
    if (newPassword.length < 6) {
      setPwError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords don't match.")
      return
    }
    setPwBusy(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwBusy(false)
    if (error) {
      setPwError(error.message)
      return
    }
    setNewPassword('')
    setConfirmPassword('')
    setPwMessage('Password updated!')
    setTimeout(() => setPwMessage(''), 2500)
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Account" />
      <div className="flex-1 flex flex-col px-6 pt-4 pb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Personal Information</p>

        <label className="text-sm font-medium mb-2">Full Name</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple"
        />

        <label className="text-sm font-medium mt-4 mb-2">Phone Number</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. +263 77 123 4567"
          className="border border-gray-200 rounded-xl px-4 py-3 outline-brand-purple"
        />

        <label className="text-sm font-medium mt-4 mb-2">Email</label>
        <p className="text-sm text-gray-500 border border-gray-100 rounded-xl px-4 py-3 bg-gray-50">{user?.email}</p>

        {saved ? <p className="text-green-600 text-sm mt-3">Saved!</p> : null}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 w-full bg-brand-purple text-white font-medium py-3 rounded-xl disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        <button
          onClick={() => navigate('/edit-profile-details')}
          className="mt-3 w-full flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 text-sm"
        >
          <span>Bio, username & location</span>
          <ChevronRight size={16} className="text-gray-400" />
        </button>

        <div className="h-px bg-gray-100 my-6" />

        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Security</p>

        {isEmailAccount ? (
          <div className="border border-gray-200 rounded-xl p-4">
            <p className="font-medium text-sm flex items-center gap-2"><KeyRound size={15} className="text-brand-purple" /> Change Password</p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-brand-purple mt-3"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-brand-purple mt-2"
            />
            {pwError ? <p className="text-red-500 text-xs mt-2">{pwError}</p> : null}
            {pwMessage ? <p className="text-green-600 text-xs mt-2">{pwMessage}</p> : null}
            <button
              onClick={handleChangePassword}
              disabled={pwBusy}
              className="w-full bg-brand-purple text-white font-medium py-2.5 rounded-lg text-sm mt-3 disabled:opacity-60"
            >
              {pwBusy ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400 border border-gray-100 rounded-xl p-4">
            You signed in with Google, so there's no Schoolink password to change here — manage your password through your Google Account instead.
          </p>
        )}

        <button
          onClick={() => navigate('/settings/two-factor')}
          className="mt-3 w-full flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 text-sm"
        >
          <span className="flex items-center gap-2"><ShieldCheck size={15} className="text-brand-purple" /> Two-Factor Authentication</span>
          <ChevronRight size={16} className="text-gray-400" />
        </button>

        <button
          onClick={() => navigate('/settings/login-history')}
          className="mt-2 w-full flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 text-sm"
        >
          <span className="flex items-center gap-2"><Clock size={15} className="text-brand-purple" /> Login History</span>
          <ChevronRight size={16} className="text-gray-400" />
        </button>

        <div className="h-px bg-gray-100 my-6" />

        <button
          onClick={() => {
            signOut()
            navigate('/')
          }}
          className="text-red-500 font-medium text-sm text-left"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
