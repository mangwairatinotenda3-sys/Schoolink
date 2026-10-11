import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'

import Welcome from './pages/Welcome.jsx'
import JoinByLink from './pages/JoinByLink.jsx'

import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import TermsOfService from './pages/TermsOfService.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import AccountType from './pages/AccountType.jsx'
import CreateSchool from './pages/CreateSchool.jsx'
import JoinSchool from './pages/JoinSchool.jsx'
import JoinAsStudent from './pages/JoinAsStudent.jsx'
import SelectAlumniSchool from './pages/SelectAlumniSchool.jsx'
import InviteMember from './pages/InviteMember.jsx'
import ReportsQueue from './pages/ReportsQueue.jsx'
import StaffDirectory from './pages/StaffDirectory.jsx'
import PendingApprovals from './pages/PendingApprovals.jsx'
import SchoolProfile from './pages/SchoolProfile.jsx'
import BrowseSchools from './pages/BrowseSchools.jsx'
import EditProfileDetails from './pages/EditProfileDetails.jsx'
import Library from './pages/Library.jsx'
import DocumentViewerPage from './pages/DocumentViewerPage.jsx'
import ChatList from './pages/ChatList.jsx'
import ChatThread from './pages/ChatThread.jsx'
import ChatOptions from './pages/ChatOptions.jsx'
import NewChatPicker from './pages/NewChatPicker.jsx'
import CreateGroupFromChat from './pages/CreateGroupFromChat.jsx'
import Communities from './pages/Communities.jsx'
import CreateCommunity from './pages/CreateCommunity.jsx'
import CommunityJoinRequests from './pages/CommunityJoinRequests.jsx'
import CommunityGroupInfo from './pages/CommunityGroupInfo.jsx'
import CommunityMedia from './pages/CommunityMedia.jsx'
import JoinCommunityByInvite from './pages/JoinCommunityByInvite.jsx'
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
import BlockedUsers from './pages/BlockedUsers.jsx'
import StarredMessages from './pages/StarredMessages.jsx'
import FavouriteChats from './pages/FavouriteChats.jsx'
import LoginHistory from './pages/LoginHistory.jsx'
import TwoFactorSettings from './pages/TwoFactorSettings.jsx'
import GetVerified from './pages/GetVerified.jsx'
import AdminVerification from './pages/AdminVerification.jsx'
import GetSchoolVerified from './pages/GetSchoolVerified.jsx'
import PostDetail from './pages/PostDetail.jsx'
import MyPosts from './pages/MyPosts.jsx'
import Connections from './pages/Connections.jsx'
import Polls from './pages/Polls.jsx'
import AlumniDirectory from './pages/AlumniDirectory.jsx'
import AboutSchoolink from './pages/AboutSchoolink.jsx'
import Achievements from './pages/Achievements.jsx'
import CounsellingDashboard from './pages/CounsellingDashboard.jsx'
import ReceptionistDashboard from './pages/ReceptionistDashboard.jsx'
import MoreHub from './pages/MoreHub.jsx'
import CreateStatus from './pages/CreateStatus.jsx'
import StatusViewer from './pages/StatusViewer.jsx'
import UnifiedSearch from './pages/UnifiedSearch.jsx'
import SendProposal from './pages/SendProposal.jsx'
import ViewProposals from './pages/ViewProposals.jsx'
import ExamResults from './pages/ExamResults.jsx'
import PublicProfile from './pages/PublicProfile.jsx'
import Home from './pages/Home.jsx'
import Profile from './pages/Profile.jsx'
import Settings from './pages/Settings.jsx'
import Saved from './pages/Saved.jsx'
import Notifications from './pages/Notifications.jsx'
import AddPost from './pages/AddPost.jsx'
import Dashboard from './pages/Dashboard.jsx'
import TranslateBanner from './components/TranslateBanner.jsx'
import TeamInvitePrompt from './components/TeamInvitePrompt.jsx'
import GuestPrompt from './components/GuestPrompt.jsx'
import GuestWall from './components/GuestWall.jsx'
import GuestProfileView from './components/GuestProfileView.jsx'
import { guestCanOpen } from './lib/guestShield.js'
import TeamInvite from './pages/TeamInvite.jsx'
import ControllerHome from './pages/ControllerHome.jsx'
import ControllerTeam from './pages/ControllerTeam.jsx'
import ControllerReports from './pages/ControllerReports.jsx'
import ControllerComplaints from './pages/ControllerComplaints.jsx'
import ControllerUsers from './pages/ControllerUsers.jsx'
import ControllerActivity from './pages/ControllerActivity.jsx'
import ControllerAnnounce from './pages/ControllerAnnounce.jsx'
import ControllerProfile from './pages/ControllerProfile.jsx'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-shell items-center justify-center flex">Loading…</div>
  if (!user) return <Navigate to="/" replace />
  return children
}

// Pages anyone can open, even a signed-in team member.
const PUBLIC_PATHS = ['/', '/terms', '/privacy', '/forgot-password', '/reset-password']

// Guests see a sign-in invitation instead of a profile.
function ProfileRoute() {
  const { isGuest } = useAuth()
  return isGuest ? <GuestProfileView /> : <Profile />
}

function BannedScreen() {
  const { signOut } = useAuth()
  return (
    <div className="app-shell flex flex-col items-center justify-center text-center px-8 gap-3">
      <p className="text-lg font-semibold">Your account has been suspended</p>
      <p className="text-sm text-gray-500">You can't use Schoolink right now. If you think this is a mistake, contact support.</p>
      <button onClick={signOut} className="mt-2 bg-brand-purple text-white font-medium px-6 py-2.5 rounded-xl">Sign out</button>
    </div>
  )
}

export default function App() {
  const { user, profile, teamRole, teamLoading, isGuest } = useAuth()
  const location = useLocation()
  const shellClasses = ['app-shell', 'shadow-xl', profile?.dark_mode ? 'dark-mode' : '', profile?.high_contrast ? 'high-contrast' : ''].filter(Boolean).join(' ')

  const path = location.pathname
  const inControlCenter = path.startsWith('/controller') || path.startsWith('/admin')

  // Team members never see the normal app: after login they land in the Control Center.
  if (user && teamLoading) return <div className="app-shell flex items-center justify-center">Loading…</div>
  if (user && teamRole && !inControlCenter && !PUBLIC_PATHS.includes(path)) return <Navigate to="/controller" replace />
  if (user && profile?.is_banned && !teamRole) return <BannedScreen />

  // Guests can only open a few pages; everything else asks them to sign in.
  if (isGuest && !guestCanOpen(path)) {
    return (
      <div className={shellClasses}>
        <GuestWall />
        <GuestPrompt />
      </div>
    )
  }

  return (
    <div className={shellClasses}>
      <TranslateBanner />
      <GuestPrompt />
      {user && !teamRole && !isGuest && path !== '/' ? <TeamInvitePrompt /> : null}
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/join/:code" element={<JoinByLink />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/post/:postId" element={<RequireAuth><PostDetail /></RequireAuth>} />
        <Route path="/my-posts" element={<RequireAuth><MyPosts /></RequireAuth>} />
        <Route path="/connections/:type" element={<RequireAuth><Connections /></RequireAuth>} />
        <Route path="/polls" element={<RequireAuth><Polls /></RequireAuth>} />
        <Route path="/alumni" element={<RequireAuth><AlumniDirectory /></RequireAuth>} />
        <Route path="/about" element={<RequireAuth><AboutSchoolink /></RequireAuth>} />
        <Route path="/achievements" element={<RequireAuth><Achievements /></RequireAuth>} />
        <Route path="/counselling" element={<RequireAuth><CounsellingDashboard /></RequireAuth>} />
        <Route path="/reception" element={<RequireAuth><ReceptionistDashboard /></RequireAuth>} />
        <Route path="/more" element={<RequireAuth><MoreHub /></RequireAuth>} />
        <Route path="/statuses/create" element={<RequireAuth><CreateStatus /></RequireAuth>} />
        <Route path="/statuses/:userId" element={<RequireAuth><StatusViewer /></RequireAuth>} />
        <Route path="/search" element={<RequireAuth><UnifiedSearch /></RequireAuth>} />
        <Route path="/proposals" element={<RequireAuth><ViewProposals /></RequireAuth>} />
        <Route path="/exam-results" element={<RequireAuth><ExamResults /></RequireAuth>} />
        <Route path="/users/:userId" element={<RequireAuth><PublicProfile /></RequireAuth>} />

        <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><ProfileRoute /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        <Route path="/saved" element={<RequireAuth><Saved /></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
        <Route path="/add-post" element={<RequireAuth><AddPost /></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />

        <Route path="/team/invite" element={<RequireAuth><TeamInvite /></RequireAuth>} />

        <Route path="/controller" element={<RequireAuth><ControllerHome /></RequireAuth>} />
        <Route path="/controller/verification" element={<RequireAuth><AdminVerification /></RequireAuth>} />
        <Route path="/controller/reports" element={<RequireAuth><ControllerReports /></RequireAuth>} />
        <Route path="/controller/complaints" element={<RequireAuth><ControllerComplaints /></RequireAuth>} />
        <Route path="/controller/users" element={<RequireAuth><ControllerUsers /></RequireAuth>} />
        <Route path="/controller/team" element={<RequireAuth><ControllerTeam /></RequireAuth>} />
        <Route path="/controller/activity" element={<RequireAuth><ControllerActivity /></RequireAuth>} />
        <Route path="/controller/announce" element={<RequireAuth><ControllerAnnounce /></RequireAuth>} />
        <Route path="/controller/profile" element={<RequireAuth><ControllerProfile /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
        }
        <Route path="/post/:postId" element={<RequireAuth><PostDetail /></RequireAuth>} />
        <Route path="/my-posts" element={<RequireAuth><MyPosts /></RequireAuth>} />
        <Route path="/connections/:type" element={<RequireAuth><Connections /></RequireAuth>} />
        <Route path="/polls" element={<RequireAuth><Polls /></RequireAuth>} />
        <Route path="/alumni" element={<RequireAuth><AlumniDirectory /></RequireAuth>} />
        <Route path="/about" element={<RequireAuth><AboutSchoolink /></RequireAuth>} />
        <Route path="/achievements" element={<RequireAuth><Achievements /></RequireAuth>} />
        <Route path="/counselling" element={<RequireAuth><CounsellingDashboard /></RequireAuth>} />
        <Route path="/reception" element={<RequireAuth><ReceptionistDashboard /></RequireAuth>} />
        <Route path="/more" element={<RequireAuth><MoreHub /></RequireAuth>} />
        <Route path="/statuses/create" element={<RequireAuth><CreateStatus /></RequireAuth>} />
        <Route path="/statuses/:userId" element={<RequireAuth><StatusViewer /></RequireAuth>} />
        <Route path="/search" element={<RequireAuth><UnifiedSearch /></RequireAuth>} />
        <Route path="/proposals" element={<RequireAuth><ViewProposals /></RequireAuth>} />
        <Route path="/exam-results" element={<RequireAuth><ExamResults /></RequireAuth>} />
        <Route path="/users/:userId" element={<RequireAuth><PublicProfile /></RequireAuth>} />

        <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><ProfileRoute /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        <Route path="/saved" element={<RequireAuth><Saved /></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
        <Route path="/add-post" element={<RequireAuth><AddPost /></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />

        <Route path="/team/invite" element={<RequireAuth><TeamInvite /></RequireAuth>} />

        <Route path="/controller" element={<RequireAuth><ControllerHome /></RequireAuth>} />
        <Route path="/controller/verification" element={<RequireAuth><AdminVerification /></RequireAuth>} />
        <Route path="/controller/reports" element={<RequireAuth><ControllerReports /></RequireAuth>} />
        <Route path="/controller/complaints" element={<RequireAuth><ControllerComplaints /></RequireAuth>} />
        <Route path="/controller/users" element={<RequireAuth><ControllerUsers /></RequireAuth>} />
        <Route path="/controller/team" element={<RequireAuth><ControllerTeam /></RequireAuth>} />
        <Route path="/controller/activity" element={<RequireAuth><ControllerActivity /></RequireAuth>} />
        <Route path="/controller/announce" element={<RequireAuth><ControllerAnnounce /></RequireAuth>} />
        <Route path="/controller/profile" element={<RequireAuth><ControllerProfile /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
      }
