import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function CallScreen() {
  const { roomId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const containerRef = useRef(null)
  const apiRef = useRef(null)
  const [loading, setLoading] = useState(true)

  const callTitle = searchParams.get('title') || 'Schoolink Call'
  const startWithVideo = searchParams.get('video') !== '0'

  useEffect(() => {
    let script

    function initJitsi() {
      if (!window.JitsiMeetExternalAPI || !containerRef.current) return
      apiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName: roomId,
        parentNode: containerRef.current,
        width: '100%',
        height: '100%',
        userInfo: {
          displayName: profile?.full_name || user?.email || 'Schoolink User',
        },
        configOverwrite: {
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          startWithVideoMuted: !startWithVideo,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
        },
      })
      apiRef.current.addEventListener('videoConferenceJoined', () => setLoading(false))
      apiRef.current.addEventListener('readyToClose', () => navigate(-1))
    }

    if (window.JitsiMeetExternalAPI) {
      initJitsi()
    } else {
      script = document.createElement('script')
      script.src = 'https://meet.jit.si/external_api.js'
      script.async = true
      script.onload = initJitsi
      document.body.appendChild(script)
    }

    return () => {
      apiRef.current?.dispose()
    }
  }, [roomId])

  return (
    <div className="app-shell bg-black">
      <div className="flex items-center justify-between px-4 py-3 bg-black shrink-0">
        <p className="text-white text-sm font-medium truncate">{callTitle}</p>
        <button onClick={() => navigate(-1)}><X size={20} className="text-white" /></button>
      </div>
      {loading ? <p className="text-white/60 text-center mt-10">Connecting…</p> : null}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  )
}
