import BackHeader from '../components/BackHeader.jsx'

const sections = [
  {
    title: '1. What Schoolink Is',
    body: `Schoolink is a social platform connecting schools, staff, students, parents, alumni, and investors. Schools create their own space on the platform; staff invite colleagues and students to join; and members can post, message, and take part in their school's community. Some content (like Communities and browsing schools) is open to anyone with an account, while posting and school-specific tools are limited to verified school members.`,
  },
  {
    title: '2. Accounts',
    body: `You can create an account with an email and password, with Google Sign-In, or as an anonymous Guest. You're responsible for keeping your account secure and for anything posted from it. Guest accounts have limited access and can be upgraded to a full account at any time by adding real sign-in credentials.`,
  },
  {
    title: '3. School Roles & Verification',
    body: `The first person to create a school becomes its Headteacher and can invite staff (via invite codes) and approve students (via a school join code and admin approval). Roles like Bursar, Coach, Librarian, and others unlock specific tools relevant to that role. We do not independently verify that a person creating a school is authorized to represent that institution — school leadership is responsible for managing who they invite and approve.`,
  },
  {
    title: '4. Acceptable Use',
    body: `You agree not to use Schoolink to harass, bully, impersonate others, share content you don't have rights to, post anything illegal, or attempt to disrupt the platform. School admins can remove members, delete posts, and manage their community's Communities. We may remove content or suspend accounts that violate these terms.`,
  },
  {
    title: '5. Content You Post',
    body: `You retain ownership of what you post — text, photos, videos, voice notes, and documents. By posting, you grant other members of your school (or community, or the specific person you're messaging) permission to view that content as intended by the feature you used. You can delete your own posts, messages, and community messages at any time; deletion is permanent.`,
  },
  {
    title: '6. Payments',
    body: `Where a Bursar shares a payment link for school fees, that payment is processed entirely by the third-party provider they choose (such as Stripe, PayPal, or Paynow) — Schoolink does not process, store, or have access to your payment card details. Any payment dispute should be handled directly with that provider and your school.`,
  },
  {
    title: '7. Third-Party Services',
    body: `Schoolink is built on Supabase (authentication, database, and file storage), hosted on GitHub Pages, and optionally uses Google Sign-In and Google Translate. Video/voice group calling, where available, uses Jitsi Meet's public infrastructure. Using these features means your data passes through those providers as described in our Privacy Policy.`,
  },
  {
    title: '8. Account Deletion',
    body: `You can leave a school or community and remove content yourself at any time. To request full account deletion, use Settings → Help and Feedback to contact us — we'll process the request as soon as reasonably possible.`,
  },
  {
    title: '9. Changes to These Terms',
    body: `We may update these terms as Schoolink grows. Continued use of the platform after changes means you accept the updated terms.`,
  },
  {
    title: '10. Contact',
    body: `Questions about these terms can be sent via Settings → Help and Feedback.`,
  },
]

export default function TermsOfService() {
  return (
    <div className="app-shell">
      <BackHeader title="Terms of Service" />
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
