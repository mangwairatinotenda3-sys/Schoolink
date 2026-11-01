import { useEffect, useRef, useState } from 'react'

// Picks a sound format this phone can record and play back.
function pickAudioType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || ''
}

// Tap the microphone to start, tap send to send, or the bin to throw the recording away.
export default function useVoiceRecorder({ onRecorded, onError }) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const startedAtRef = useRef(0)
  const cancelRef = useRef(false)
  const handlersRef = useRef({ onRecorded, onError })
  handlersRef.current = { onRecorded, onError }

  useEffect(() => {
    if (!recording) return undefined
    setSeconds(0)
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [recording])

  function releaseMic() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  // Leaving the screen releases the microphone and sends nothing.
  useEffect(() => () => {
    cancelRef.current = true
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    releaseMic()
  }, [])

  function handleStop() {
    releaseMic()
    setRecording(false)
    if (cancelRef.current) return
    const rec = recorderRef.current
    const base = (rec?.mimeType || 'audio/webm').split(';')[0]
    const ext = base.includes('mp4') ? 'm4a' : base.includes('ogg') ? 'ogg' : 'webm'
    const blob = new Blob(chunksRef.current, { type: base })
    if (Date.now() - startedAtRef.current < 700 || blob.size === 0) {
      handlersRef.current.onError?.('That was too short. Tap the microphone and speak a little longer.')
      return
    }
    handlersRef.current.onRecorded?.(new File([blob], `voice-${Date.now()}.${ext}`, { type: base }))
  }

  async function start() {
    if (recorderRef.current?.state === 'recording') return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      handlersRef.current.onError?.("This phone can't record voice messages.")
      return
    }
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      handlersRef.current.onError?.('Schoolink needs the microphone. Allow it in your phone settings, then try again.')
      return
    }
    try {
      const type = pickAudioType()
      const rec = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream)
      chunksRef.current = []
      cancelRef.current = false
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = handleStop
      recorderRef.current = rec
      streamRef.current = stream
      rec.start(250)
      startedAtRef.current = Date.now()
      setRecording(true)
    } catch {
      stream.getTracks().forEach((t) => t.stop())
      handlersRef.current.onError?.("This phone couldn't start a voice recording. Try again.")
    }
  }

  function stop() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    setRecording(false)
  }

  function cancel() {
    cancelRef.current = true
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    setRecording(false)
  }

  return { recording, seconds, start, stop, cancel }
}
