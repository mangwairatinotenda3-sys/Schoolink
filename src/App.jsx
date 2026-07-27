import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'

import Welcome from './pages/Welcome.jsx'
import SignInEmail from './pages/SignInEmail.jsx'
import SignInPassword from './pages/SignInPassword.jsx'
import ChooseSchoolType from './pages/ChooseSchoolType.jsx'
import ChooseRole from './pages/ChooseRole.jsx'
import Home from './pages/Home.jsx'
import Profile from './pages/Profile.jsx'
import Settings from './pages/Settings.jsx'
import Saved from './pages/Saved.jsx'
import Notifications from './pages/Notifications.jsx'
import AddPost from './pages/AddPost.jsx'
import Dashboard from './pages/Dashboard.jsx'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-shell items-center justify-center flex">Loading…</div>
  if (!user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <div className="app-shell shadow-xl">
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/sign-in/email" element={<SignInEmail />} />
        <Route path="/sign-in/password" element={<SignInPassword />} />

        <Route
          path="/onboarding/school-type"
          element={
            <RequireAuth>
              <ChooseSchoolType />
            </RequireAuth>
          }
        />
        <Route
          path="/onboarding/role"
          element={
            <RequireAuth>
              <ChooseRole />
            </RequireAuth>
          }
        />

        <Route
          path="/home"
          element={
            <RequireAuth>
              <Home />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <Settings />
            </RequireAuth>
          }
        />
        <Route
          path="/saved"
          element={
            <RequireAuth>
              <Saved />
            </RequireAuth>
          }
        />
        <Route
          path="/notifications"
          element={
            <RequireAuth>
              <Notifications />
            </RequireAuth>
          }
        />
        <Route
          path="/add-post"
          element={
            <RequireAuth>
              <AddPost />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
  }
