import React from 'react'
import { reportCrash } from '../lib/crashReporter.js'

// Catches a crash on one screen and shows what went wrong instead of a blank white page.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Screen crashed:', error, info?.componentStack)
    reportCrash(error, 'screen')
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const message = String(error?.message || error)
    const where = String(error?.stack || '').split('\n').slice(0, 4).join('\n')

    return (
      <div className="app-shell flex flex-col items-center justify-center text-center px-6 gap-3">
        <p className="text-lg font-semibold">Something went wrong on this screen</p>
        <p className="text-sm text-gray-500">Tap Go back, or Reload. If it keeps happening, send the message below to support.</p>
        <pre className="text-[11px] text-left text-red-500 bg-red-50 rounded-lg p-3 max-w-full overflow-auto whitespace-pre-wrap break-words">{message}{where ? `\n\n${where}` : ''}</pre>
        <div className="flex gap-3 mt-1">
          <button
            onClick={() => { this.setState({ error: null }); window.location.hash = '#/chats' }}
            className="bg-gray-100 text-brand-navy font-medium px-5 py-2.5 rounded-xl"
          >
            Go back
          </button>
          <button
            onClick={() => {
              try { sessionStorage.removeItem('schoolink_chunk_reload') } catch { /* ignore */ }
              const { origin, pathname, hash } = window.location
              window.location.replace(`${origin}${pathname}?v=${Date.now()}${hash}`)
            }}
            className="bg-brand-purple text-white font-medium px-5 py-2.5 rounded-xl"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
      }
