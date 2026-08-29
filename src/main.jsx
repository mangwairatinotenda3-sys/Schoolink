import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import ThemeProvider from './lib/ThemeProvider.jsx'
import './index.css'

// Stop the browser from trying to restore scroll position on refresh —
// it fights with how this app renders content after loading, causing
// the page to jump to a position and then snap back to the top.
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister())
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
)
