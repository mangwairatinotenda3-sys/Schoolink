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
import BursarDashboard from './pages/BursarDashboard.jsx'
import CoachDashboard from './pages/CoachDashboard.jsx'
import ICTDashboard from './pages/ICTDashboard.jsx'
import Calendar from './pages/Calendar.jsx'
import CreateEvent from './pages/CreateEvent.jsx'
import Assignments from './pages/Assignments.jsx'
import Timetable from './pages/Timetable.jsx'
import AccountSettings from './pages/AccountSettings.jsx'
import PrivacySettings from './pages/PrivacySettings.jsx'
import NotificationSettings from './pages/NotificationSettings.jsx'
import AccessibilitySettings from './pages/AccessibilitySettings.jsx'
import ChatAppearanceSettings from './pages/ChatAppearanceSettings.jsx'
import LanguageSettings from './pages/LanguageSettings.jsx'
import StorageSettings from './pages/StorageSettings.jsx'
import HelpSettings from './pages/HelpSettings.jsx'
import UpdatesSettings from './pages/UpdatesSettings.jsx'
import Home from './pages/Home.jsx'
import Profile from './pages/Profile.jsx'
import Settings from './pages/Settings.jsx'
import Saved from './pages/Saved.jsx'
import Notifications from './pages/Notifications.jsx'
import AddPost from './pages/AddPost.jsx'
import Dashboard from './pages/Dashboard.jsx'
import BlockedUsers from './pages/BlockedUsers.jsx'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-shell items-center justify-center flex">Loading…</div>
  if (!user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { profile } = useAuth()
  const shellClasses = [
    'app-shell',
    'shadow-xl',
    profile?.dark_mode ? 'dark-mode' : '',
    profile?.high_contrast ? 'high-contrast' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={shellClasses}>
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
        <Route path="/bursar" element={<RequireAuth><BursarDashboard /></RequireAuth>} />
        <Route path="/coach" element={<RequireAuth><CoachDashboard /></RequireAuth>} />
        <Route path="/ict" element={<RequireAuth><ICTDashboard /></RequireAuth>} />
        <Route path="/calendar" element={<RequireAuth><Calendar /></RequireAuth>} />
        <Route path="/calendar/create" element={<RequireAuth><CreateEvent /></RequireAuth>} />
        <Route path="/assignments" element={<RequireAuth><Assignments /></RequireAuth>} />
        <Route path="/timetable" element={<RequireAuth><Timetable /></RequireAuth>} />
        <Route path="/settings/account" element={<RequireAuth><AccountSettings /></RequireAuth>} />
        <Route path="/settings/privacy" element={<RequireAuth><PrivacySettings /></RequireAuth>} />
        <Route path="/settings/notifications" element={<RequireAuth><NotificationSettings /></RequireAuth>} />
        <Route path="/settings/accessibility" element={<RequireAuth><AccessibilitySettings /></RequireAuth>} />
        <Route path="/settings/chat-appearance" element={<RequireAuth><ChatAppearanceSettings /></RequireAuth>} />
        <Route path="/settings/language" element={<RequireAuth><LanguageSettings /></RequireAuth>} />
        <Route path="/settings/storage" element={<RequireAuth><StorageSettings /></RequireAuth>} />
        <Route path="/settings/help" element={<RequireAuth><HelpSettings /></RequireAuth>} />
        <Route path="/settings/updates" element={<RequireAuth><UpdatesSettings /></RequireAuth>} />

        <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        <Route path="/saved" element={<RequireAuth><Saved /></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
        <Route path="/add-post" element={<RequireAuth><AddPost /></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/settings/blocked-users" element={<RequireAuth><BlockedUsers /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
  }
