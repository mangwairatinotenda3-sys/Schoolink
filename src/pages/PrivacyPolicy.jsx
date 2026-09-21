import BackHeader from '../components/BackHeader.jsx'

const sections = [
  {
    title: '1. What We Collect',
    body: `Account info: email, and for Google Sign-In, your name and profile photo. Profile info you add yourself: full name, username, bio, location, links, avatar and cover photos, role, and school. Content you create: posts, statuses, comments, chat messages, voice notes, photos, videos, and documents you upload. Usage data: which school/community you belong to, who you follow, your online status, and a basic login history (method and timestamp) used for account security.`,
  },
  {
    title: '2. What We Don\'t Collect',
    body: `We don't collect payment card details (payments happen entirely on the third-party provider's own page via links your Bursar shares). We don't request or store sensitive categories of information like health records, government ID numbers, or financial account numbers.`,
  },
  {
    title: '3. Children\'s Data',
    body: `Schoolink is used by students, including minors, as part of a school's supervised community. Student accounts are created via a school-controlled join code and require admin approval before becoming active. Schools and parents are responsible for deciding whether a student's participation is appropriate; we recommend school administrators review this policy with families as part of their own enrollment process.`,
  },
  {
    title: '4. How We Use Your Data',
    body: `To operate core features: your feed, notifications, chat, communities, and school tools. To keep the platform secure, including basic login history. To let other members see profile information you've chosen to share (bio, posts, etc.) according to the visibility settings for your account type. We do not sell your data to third parties or use it for advertising — Schoolink does not display ads.`,
  },
  {
    title: '5. Where Your Data Lives',
    body: `Your data is stored and processed by Supabase (our database, authentication, and file storage provider) and served via GitHub Pages. If you sign in with Google or use Google Translate, Google processes the relevant data under its own privacy policy. Group calls, where available, run on Jitsi Meet's public servers and aren't stored by Schoolink at all.`,
  },
  {
    title: '6. Your Choices',
    body: `You can edit or remove most profile information yourself at any time in Settings. You can delete your own posts, messages, and community messages permanently. You can block other users, control who sees your profile, disable read receipts, and turn off notification types individually. You can request full account deletion via Settings → Help and Feedback.`,
  },
  {
    title: '7. Cookies & Local Storage',
    body: `We use your browser's local storage to remember your last-used email (if you enable "Remember me") and your language translation preference. Google Translate sets its own cookie when active. We don't use tracking or advertising cookies.`,
  },
  {
    title: '8. Data Security',
    body: `Access to your data is controlled through database-level security rules (so, for example, private messages are only ever readable by the two people in that conversation, and school-specific tools are restricted to that school's members). No system is perfectly secure, and we encourage using a strong password and enabling Two-Factor Authentication in Settings.`,
  },
  {
    title: '9. Changes to This Policy',
    body: `We may update this policy as features change. Meaningful changes will be reflected here with an updated date.`,
  },
  {
    title: '10. Contact',
    body: `Questions about your data or this policy can be sent via Settings → Help and Feedback.`,
  },
]

export default function PrivacyPolicy() {
  return (
    <div className="app-shell">
      <BackHeader title="Privacy Policy" />
      <div className="screen-scroll px-6 pt-2 pb-8">
        <p className="text-xs text-gray-400 mb-4">Last updated: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        {sections.map((s) => (
          <div key={s.title} className="mb-5">
            <p className="font-semibold text-sm mb-1">{s.title}</p>
            <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
