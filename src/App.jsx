import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import { supabase } from './lib/supabaseClient.js'
import { PENDING_INVITE_KEY } from './pages/JoinByLink.jsx'

import Welcome from './pages/Welcome.jsx'

const Home = lazyPage(() => import('./pages/Home.jsx'))
import TranslateBanner from './components/TranslateBanner.jsx'
import TeamInvitePrompt from './components/TeamInvitePrompt.jsx'
import GuestPrompt from './components/GuestPrompt.jsx'
import PermissionsPrompt from './components/PermissionsPrompt.jsx'
import GuestWall from './components/GuestWall.jsx'
import GuestProfileView from './components/GuestProfileView.jsx'
import { guestCanOpen } from './lib/guestShield.js'

// Pages load only when someone opens them, so the app starts much faster.
// If a new version was published while the app was open, the old page file is gone:
// reload once to pick up the new version.
function lazyPage(loader) {
  return lazy(() =>
    loader()
      .then((mod) => {
        try { sessionStorage.removeItem('schoolink_chunk_reload') } catch { /* ignore */ }
        return mod
      })
      .catch((err) => {
        let already = true
        try { already = !!sessionStorage.getItem('schoolink_chunk_reload') } catch { /* ignore */ }
        if (!already) {
          try { sessionStorage.setItem('schoolink_chunk_reload', '1') } catch { /* ignore */ }
          // A plain reload can serve the same old, saved copy of the page. A new address forces the latest one.
          const { origin, pathname, hash } = window.location
          window.location.replace(`${origin}${pathname}?v=${Date.now()}${hash}`)
          return new Promise(() => {})
        }
        throw err
      })
  )
}
  
}

function PageLoading() {
  return <div className="app-shell flex items-center justify-center text-gray-400">Loading…</div>
}

// The first page. Someone who is already signed in goes straight to Home,
// so reopening the app never shows the sign-in screen again.
function RootRoute() {
  const { user, loading } = useAuth()
  const [showWelcome, setShowWelcome] = useState(false)
  const [target, setTarget] = useState(null)

  useEffect(() => {
    if (loading) return undefined
    if (!user) {
      setShowWelcome(true)
      return undefined
    }
    let cancelled = false
    let pendingInvite = false
    try {
      pendingInvite = !!localStorage.getItem(PENDING_INVITE_KEY)
    } catch {
      pendingInvite = false
    }
    if (pendingInvite) {
      setShowWelcome(true)
      return undefined
    }
    supabase
      .from('profiles')
      .select('account_type')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (data?.account_type) setTarget('/home')
        else if (error) setTarget('/home')
        else setShowWelcome(true)
      })
    return () => { cancelled = true }
  }, [loading, user])

  if (target) return <Navigate to={target} replace />
  if (showWelcome) return <Welcome />
  return <PageLoading />
}

const JoinByLink = lazyPage(() => import('./pages/JoinByLink.jsx'))
const ForgotPassword = lazyPage(() => import('./pages/ForgotPassword.jsx'))
const ResetPassword = lazyPage(() => import('./pages/ResetPassword.jsx'))
const TermsOfService = lazyPage(() => import('./pages/TermsOfService.jsx'))
const PrivacyPolicy = lazyPage(() => import('./pages/PrivacyPolicy.jsx'))
const AccountType = lazyPage(() => import('./pages/AccountType.jsx'))
const CreateSchool = lazyPage(() => import('./pages/CreateSchool.jsx'))
const JoinSchool = lazyPage(() => import('./pages/JoinSchool.jsx'))
const JoinAsStudent = lazyPage(() => import('./pages/JoinAsStudent.jsx'))
const SelectAlumniSchool = lazyPage(() => import('./pages/SelectAlumniSchool.jsx'))
const InviteMember = lazyPage(() => import('./pages/InviteMember.jsx'))
const ReportsQueue = lazyPage(() => import('./pages/ReportsQueue.jsx'))
const StaffDirectory = lazyPage(() => import('./pages/StaffDirectory.jsx'))
const PendingApprovals = lazyPage(() => import('./pages/PendingApprovals.jsx'))
const SchoolProfile = lazyPage(() => import('./pages/SchoolProfile.jsx'))
const BrowseSchools = lazyPage(() => import('./pages/BrowseSchools.jsx'))
const EditProfileDetails = lazyPage(() => import('./pages/EditProfileDetails.jsx'))
const Library = lazyPage(() => import('./pages/Library.jsx'))
const DocumentViewerPage = lazyPage(() => import('./pages/DocumentViewerPage.jsx'))
const ChatList = lazyPage(() => import('./pages/ChatList.jsx'))
const ChatThread = lazyPage(() => import('./pages/ChatThread.jsx'))
const ChatOptions = lazyPage(() => import('./pages/ChatOptions.jsx'))
const NewChatPicker = lazyPage(() => import('./pages/NewChatPicker.jsx'))
const CreateGroupFromChat = lazyPage(() => import('./pages/CreateGroupFromChat.jsx'))
const Communities = lazyPage(() => import('./pages/Communities.jsx'))
const CreateCommunity = lazyPage(() => import('./pages/CreateCommunity.jsx'))
const CommunityJoinRequests = lazyPage(() => import('./pages/CommunityJoinRequests.jsx'))
const CommunityGroupInfo = lazyPage(() => import('./pages/CommunityGroupInfo.jsx'))
const CommunityMedia = lazyPage(() => import('./pages/CommunityMedia.jsx'))
const JoinCommunityByInvite = lazyPage(() => import('./pages/JoinCommunityByInvite.jsx'))
const CommunityDetail = lazyPage(() => import('./pages/CommunityDetail.jsx'))
const BursarDashboard = lazyPage(() => import('./pages/BursarDashboard.jsx'))
const CoachDashboard = lazyPage(() => import('./pages/CoachDashboard.jsx'))
const ICTDashboard = lazyPage(() => import('./pages/ICTDashboard.jsx'))
const Calendar = lazyPage(() => import('./pages/Calendar.jsx'))
const CreateEvent = lazyPage(() => import('./pages/CreateEvent.jsx'))
const Assignments = lazyPage(() => import('./pages/Assignments.jsx'))
const Timetable = lazyPage(() => import('./pages/Timetable.jsx'))
const Attendance = lazyPage(() => import('./pages/Attendance.jsx'))
const FamilyLinks = lazyPage(() => import('./pages/FamilyLinks.jsx'))
const AccountSettings = lazyPage(() => import('./pages/AccountSettings.jsx'))
const PrivacySettings = lazyPage(() => import('./pages/PrivacySettings.jsx'))
const NotificationSettings = lazyPage(() => import('./pages/NotificationSettings.jsx'))
const AccessibilitySettings = lazyPage(() => import('./pages/AccessibilitySettings.jsx'))
const ChatAppearanceSettings = lazyPage(() => import('./pages/ChatAppearanceSettings.jsx'))
const LanguageSettings = lazyPage(() => import('./pages/LanguageSettings.jsx'))
const StorageSettings = lazyPage(() => import('./pages/StorageSettings.jsx'))
const HelpSettings = lazyPage(() => import('./pages/HelpSettings.jsx'))
const UpdatesSettings = lazyPage(() => import('./pages/UpdatesSettings.jsx'))
const BlockedUsers = lazyPage(() => import('./pages/BlockedUsers.jsx'))
const StarredMessages = lazyPage(() => import('./pages/StarredMessages.jsx'))
const FavouriteChats = lazyPage(() => import('./pages/FavouriteChats.jsx'))
const LoginHistory = lazyPage(() => import('./pages/LoginHistory.jsx'))
const TwoFactorSettings = lazyPage(() => import('./pages/TwoFactorSettings.jsx'))
const GetVerified = lazyPage(() => import('./pages/GetVerified.jsx'))
const AdminVerification = lazyPage(() => import('./pages/AdminVerification.jsx'))
const GetSchoolVerified = lazyPage(() => import('./pages/GetSchoolVerified.jsx'))
const PostDetail = lazyPage(() => import('./pages/PostDetail.jsx'))
const MyPosts = lazyPage(() => import('./pages/MyPosts.jsx'))
const Connections = lazyPage(() => import('./pages/Connections.jsx'))
const Polls = lazyPage(() => import('./pages/Polls.jsx'))
const AlumniDirectory = lazyPage(() => import('./pages/AlumniDirectory.jsx'))
const AboutSchoolink = lazyPage(() => import('./pages/AboutSchoolink.jsx'))
const Achievements = lazyPage(() => import('./pages/Achievements.jsx'))
const CounsellingDashboard = lazyPage(() => import('./pages/CounsellingDashboard.jsx'))
const ReceptionistDashboard = lazyPage(() => import('./pages/ReceptionistDashboard.jsx'))
const MoreHub = lazyPage(() => import('./pages/MoreHub.jsx'))
const CreateStatus = lazyPage(() => import('./pages/CreateStatus.jsx'))
const StatusViewer = lazyPage(() => import('./pages/StatusViewer.jsx'))
const UnifiedSearch = lazyPage(() => import('./pages/UnifiedSearch.jsx'))
const SendProposal = lazyPage(() => import('./pages/SendProposal.jsx'))
const ViewProposals = lazyPage(() => import('./pages/ViewProposals.jsx'))
const ExamResults = lazyPage(() => import('./pages/ExamResults.jsx'))
const PublicProfile = lazyPage(() => import('./pages/PublicProfile.jsx'))
const Profile = lazyPage(() => import('./pages/Profile.jsx'))
const Settings = lazyPage(() => import('./pages/Settings.jsx'))
const Saved = lazyPage(() => import('./pages/Saved.jsx'))
const Notifications = lazyPage(() => import('./pages/Notifications.jsx'))
const AddPost = lazyPage(() => import('./pages/AddPost.jsx'))
const Dashboard = lazyPage(() => import('./pages/Dashboard.jsx'))
const TeamInvite = lazyPage(() => import('./pages/TeamInvite.jsx'))
const ControllerHome = lazyPage(() => import('./pages/ControllerHome.jsx'))
const ControllerTeam = lazyPage(() => import('./pages/ControllerTeam.jsx'))
const ControllerReports = lazyPage(() => import('./pages/ControllerReports.jsx'))
const ControllerComplaints = lazyPage(() => import('./pages/ControllerComplaints.jsx'))
const ControllerUsers = lazyPage(() => import('./pages/ControllerUsers.jsx'))
const ControllerActivity = lazyPage(() => import('./pages/ControllerActivity.jsx'))
const ControllerAnnounce = lazyPage(() => import('./pages/ControllerAnnounce.jsx'))
const ControllerProfile = lazyPage(() => import('./pages/ControllerProfile.jsx'))

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
      <PermissionsPrompt />
      <GuestPrompt />
      {user && !teamRole && !isGuest && path !== '/' ? <TeamInvitePrompt /> : null}
      <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/join/:code" element={<JoinByLink />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />

        <Route path="/onboarding/account-type" element={<RequireAuth><AccountType /></RequireAuth>} />
        <Route path="/onboarding/create-school" element={<RequireAuth><CreateSchool /></RequireAuth>} />
        <Route path="/onboarding/join-school" element={<RequireAuth><JoinSchool /></RequireAuth>} />
        <Route path="/onboarding/join-student" element={<RequireAuth><JoinAsStudent /></RequireAuth>} />
        <Route path="/onboarding/select-alumni-school" element={<RequireAuth><SelectAlumniSchool /></RequireAuth>} />
        <Route path="/invite-member" element={<RequireAuth><InviteMember /></RequireAuth>} />
        <Route path="/reports" element={<RequireAuth><ReportsQueue /></RequireAuth>} />
        <Route path="/staff-directory" element={<RequireAuth><StaffDirectory /></RequireAuth>} />
        <Route path="/pending-approvals" element={<RequireAuth><PendingApprovals /></RequireAuth>} />
        <Route path="/school-profile" element={<RequireAuth><SchoolProfile /></RequireAuth>} />
        <Route path="/school-profile/verification" element={<RequireAuth><GetSchoolVerified /></RequireAuth>} />
        <Route path="/schools" element={<RequireAuth><BrowseSchools /></RequireAuth>} />
        <Route path="/schools/:schoolId" element={<RequireAuth><SchoolProfile /></RequireAuth>} />
        <Route path="/schools/:schoolId/propose" element={<RequireAuth><SendProposal /></RequireAuth>} />
        <Route path="/edit-profile-details" element={<RequireAuth><EditProfileDetails /></RequireAuth>} />
        <Route path="/library" element={<RequireAuth><Library /></RequireAuth>} />
        <Route path="/viewer/:id" element={<RequireAuth><DocumentViewerPage /></RequireAuth>} />
        <Route path="/document/:id" element={<RequireAuth><DocumentViewerPage /></RequireAuth>} />

        <Route path="/chats" element={<RequireAuth><ChatList /></RequireAuth>} />
        <Route path="/chats/new" element={<RequireAuth><NewChatPicker /></RequireAuth>} />
        <Route path="/chats/:userId" element={<RequireAuth><ChatThread /></RequireAuth>} />
        <Route path="/chats/:userId/options" element={<RequireAuth><ChatOptions /></RequireAuth>} />
        <Route path="/chats/:userId/create-group" element={<RequireAuth><CreateGroupFromChat /></RequireAuth>} />

        <Route path="/communities" element={<RequireAuth><Communities /></RequireAuth>} />
        <Route path="/communities/create" element={<RequireAuth><CreateCommunity /></RequireAuth>} />
        <Route path="/communities/join/:inviteCode" element={<RequireAuth><JoinCommunityByInvite /></RequireAuth>} />
        <Route path="/communities/:communityId/requests" element={<RequireAuth><CommunityJoinRequests /></RequireAuth>} />
        <Route path="/communities/:communityId/info" element={<RequireAuth><CommunityGroupInfo /></RequireAuth>} />
        <Route path="/communities/:communityId/media" element={<RequireAuth><CommunityMedia /></RequireAuth>} />
        <Route path="/communities/:communityId" element={<RequireAuth><CommunityDetail /></RequireAuth>} />

        <Route path="/bursar" element={<RequireAuth><BursarDashboard /></RequireAuth>} />
        <Route path="/coach" element={<RequireAuth><CoachDashboard /></RequireAuth>} />
        <Route path="/ict" element={<RequireAuth><ICTDashboard /></RequireAuth>} />
        <Route path="/calendar" element={<RequireAuth><Calendar /></RequireAuth>} />
        <Route path="/calendar/create" element={<RequireAuth><CreateEvent /></RequireAuth>} />
        <Route path="/assignments" element={<RequireAuth><Assignments /></RequireAuth>} />
        <Route path="/timetable" element={<RequireAuth><Timetable /></RequireAuth>} />
        <Route path="/attendance" element={<RequireAuth><Attendance /></RequireAuth>} />
        <Route path="/family" element={<RequireAuth><FamilyLinks /></RequireAuth>} />

        <Route path="/settings/account" element={<RequireAuth><AccountSettings /></RequireAuth>} />
        <Route path="/settings/privacy" element={<RequireAuth><PrivacySettings /></RequireAuth>} />
        <Route path="/settings/notifications" element={<RequireAuth><NotificationSettings /></RequireAuth>} />
        <Route path="/settings/accessibility" element={<RequireAuth><AccessibilitySettings /></RequireAuth>} />
        <Route path="/settings/chat-appearance" element={<RequireAuth><ChatAppearanceSettings /></RequireAuth>} />
        <Route path="/settings/language" element={<RequireAuth><LanguageSettings /></RequireAuth>} />
        <Route path="/settings/storage" element={<RequireAuth><StorageSettings /></RequireAuth>} />
        <Route path="/settings/help" element={<RequireAuth><HelpSettings /></RequireAuth>} />
        <Route path="/settings/updates" element={<RequireAuth><UpdatesSettings /></RequireAuth>} />
        <Route path="/settings/blocked-users" element={<RequireAuth><BlockedUsers /></RequireAuth>} />
        <Route path="/settings/starred" element={<RequireAuth><StarredMessages /></RequireAuth>} />
        <Route path="/settings/favourite-chats" element={<RequireAuth><FavouriteChats /></RequireAuth>} />
        <Route path="/settings/login-history" element={<RequireAuth><LoginHistory /></RequireAuth>} />
        <Route path="/settings/two-factor" element={<RequireAuth><TwoFactorSettings /></RequireAuth>} />
        <Route path="/settings/verification" element={<RequireAuth><GetVerified /></RequireAuth>} />
        <Route path="/admin/verification" element={<RequireAuth><AdminVerification /></RequireAuth>} />

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
      </Suspense>
    </div>
  )
        }
