import { useEffect, useState } from 'react'
import BackHeader from '../components/BackHeader.jsx'
import { supabase } from '../lib/supabaseClient.js'

export default function TwoFactorSettings() {
  const [factors, setFactors] = useState([])
  const [enrolling, setEnrolling] = useState(false)
  const [qrCode, setQrCode] = useState(null)
  const [factorId, setFactorId] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    loadFactors()
  }, [])

  async function loadFactors() {
    const { data } = await supabase.auth.mfa.listFactors()
    setFactors(data?.totp ?? [])
  }

  async function startEnroll() {
    setError('')
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
    if (enrollError) {
      setError(enrollError.message)
      return
    }
    setQrCode(data.totp.qr_code)
    setFactorId(data.id)
    setEnrolling(true)
  }

  async function confirmEnroll() {
    if (!code.trim()) return
    setBusy(true)
    setError('')
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError) {
      setError(challengeError.message)
      setBusy(false)
      return
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
    setBusy(false)
    if (verifyError) {
      setError('Incorrect code — check your authenticator app and try again.')
      return
    }
    setEnrolling(false)
    setQrCode(null)
    setCode('')
    loadFactors()
  }

  async function handleRemove(id) {
    if (!window.confirm('Turn off two-factor authentication?')) return
    await supabase.auth.mfa.unenroll({ factorId: id })
    loadFactors()
  }

  return (
    <div className="app-shell">
      <BackHeader title="Two-Factor Authentication" />
      <div className="screen-scroll px-6 pt-4">
        <p className="text-sm text-gray-500 mb-4">
          Add an extra layer of security using an authenticator app (like Google Authenticator or Authy).
        </p>

        {factors.length > 0 ? (
          <div className="border border-gray-100 rounded-xl p-4">
            <p className="font-medium text-sm text-green-600">Two-factor authentication is ON</p>
            <button onClick={() => handleRemove(factors[0].id)} className="text-red-500 text-sm font-medium mt-2">
              Turn off
            </button>
          </div>
        ) : enrolling ? (
          <div className="border border-gray-100 rounded-xl p-4">
            <p className="font-medium text-sm mb-2">Scan this QR code</p>
            {qrCode ? <img src={qrCode} alt="QR code" className="w-40 h-40 mx-auto mb-3" /> : null}
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter 6-digit code"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-brand-purple text-center"
            />
            {error ? <p className="text-red-500 text-xs mt-2">{error}</p> : null}
            <button
              onClick={confirmEnroll}
              disabled={busy}
              className="w-full bg-brand-purple text-white font-medium py-2.5 rounded-lg text-sm mt-3 disabled:opacity-60"
            >
              {busy ? 'Verifying…' : 'Confirm & Enable'}
            </button>
          </div>
        ) : (
          <button onClick={startEnroll} className="w-full bg-brand-purple text-white font-medium py-3 rounded-xl">
            Enable Two-Factor Authentication
          </button>
        )}
        {error && !enrolling ? <p className="text-red-500 text-sm mt-3">{error}</p> : null}
      </div>
    </div>
  )
}
