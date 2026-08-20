import { useState } from 'react'
import BackHeader from '../components/BackHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full relative transition-colors ${checked ? 'bg-brand-purple' : 'bg-gray-200'}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export default function PrivacySettings() {
  const { profile, saveProfileDetails } = useAuth()
  const [showOnline, setShowOnline] = useState(profile?.show_online_status ?? true)
  const [visibility, setVisibility] = useState(profile?.profile_visibility || 'everyone')

  async function updateShowOnline(value) {
    setShowOnline(value)
    await saveProfileDetails({ show_online_status: value })
  }

  async function updateVisibility(value) {
    setVisibility(value)
    await saveProfileDetails({ profile_visibility: value })
  }

  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Privacy" />
      <div className="flex-1 flex flex-col px-6 pt-4">
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <p className="font-medium text-sm">Show Online Status</p>
            <p className="text-xs text-gray-400">Let others see when you're active</p>
          </div>
          <Toggle checked={showOnline} onChange={updateShowOnline} />
        </div>

        <div className="py-3">
          <p className="font-medium text-sm mb-2">Who can see my profile</p>
          {['everyone', 'school_only'].map((v) => (
            <button
              key={v}
              onClick={() => updateVisibility(v)}
              className="w-full flex items-center justify-between py-2.5 text-left"
            >
              <span className="text-sm text-gray-700">
                {v === 'everyone' ? 'Everyone on Schoolink' : 'Only my school'}
              </span>
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  visibility === v ? 'border-brand-purple' : 'border-gray-300'
                }`}
              >
                {visibility === v ? <span className="w-2.5 h-2.5 rounded-full bg-brand-purple" /> : null}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
