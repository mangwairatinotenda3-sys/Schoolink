import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'

import Welcome from './pages/Welcome.jsx'
import SignInEmail from './pages/SignInEmail.jsx'
import SignInPassword from './pages/SignInPassword.jsx'
import AccountType from './pages/AccountType.jsx'
import CreateSchool from './pages/CreateSchool.jsx'
import JoinSchool from './pages/JoinSchool.jsx'
import JoinAsStudent from './pages/JoinAsStudent.jsx'
import InviteMember from './pages/InviteMember.jsx'
import StaffDirectory from './pages/StaffDirectory.jsx'
import PendingApprovals from './pages/PendingApprovals.jsx'
import SchoolProfile from './pages/SchoolProfile.jsx'
import EditProfileDetails from './pages/EditProfileDetails.jsx'
import Library from './pages/Library.jsx'
import ChatList from './pages/ChatList.jsx'
import ChatThread from './pages/ChatThread.jsx'
import Communities from './pages/Communities.jsx'
import CreateCommunity from './pages/CreateCommunity.jsx'
import CommunityDetail from './pages/CommunityDetail.jsx'
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

        <Route path="/onboarding/account-type" element={<RequireAuth><AccountType /></RequireAuth>} />
        <Route path="/onboarding/create-school" element={<RequireAuth><CreateSchool /></RequireAuth>} />
        <Route path="/onboarding/join-school" element={<RequireAuth><JoinSchool /></RequireAuth>} />
        <Route path="/onboarding/join-student" element={<RequireAuth><JoinAsStudent /></RequireAuth>} />
        <Route path="/invite-member" element={<RequireAuth><InviteMember /></RequireAuth>} />
        <Route path="/staff-directory" element={<RequireAuth><StaffDirectory /></RequireAuth>} />
        <Route path="/pending-approvals" element={<RequireAuth><PendingApprovals /></RequireAuth>} />
        <Route path="/school-profile" element={<RequireAuth><SchoolProfile /></RequireAuth>} />
        <Route path="/edit-profile-details" element={<RequireAuth><EditProfileDetails /></RequireAuth>} />
        <Route path="/library" element={<RequireAuth><Library /></RequireAuth>} />
        <Route path="/chats" element={<RequireAuth><ChatList /></RequireAuth>} />
        <Route path="/chats/:userId" element={<RequireAuth><ChatThread /></RequireAuth>} />
        <Route path="/communities" element={<RequireAuth><Communities /></RequireAuth>} />
        <Route path="/communities/create" element={<RequireAuth><CreateCommunity /></RequireAuth>} />
        <Route path="/communities/:communityId" element={<RequireAuth><CommunityDetail /></RequireAuth>} />

        <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        <Route path="/saved" element={<RequireAuth><Saved /></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
        <Route path="/add-post" element={<RequireAuth><AddPost /></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
