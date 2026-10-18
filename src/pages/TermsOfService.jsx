import LegalDoc from '../components/LegalDoc.jsx'

const sections = [
  {
    title: 'What Schoolink is',
    short: 'About',
    lead: 'Schoolink is a social platform that connects schools, staff, students, parents, alumni and investors. Each school has its own space. Staff invite colleagues, students join with a school code and approval, and members post, message and take part in their school and in communities.',
    after: 'Some things are open to anyone with an account, such as browsing schools and joining public communities. Posting for a school and the school tools are for verified school members.',
  },
  {
    title: 'Accounts and guests',
    short: 'Accounts',
    lead: 'You can sign up with an email and password or with Google. You are responsible for keeping your account secure and for what is done from it.',
    points: [
      'Guest mode lets you look around without an account. A guest can browse, search and read updates.',
      'Following people, posting, messaging, joining communities and downloading files need a real account, and the app will ask you to sign in.',
      'Help and feedback still work for guests.',
      'A guest account has no email or password, so if you sign out or clear the app it may be lost. You can turn it into a full account at any time.',
    ],
  },
  {
    title: 'Roles, schools and verification',
    short: 'Roles',
    lead: 'The person who creates a school becomes its Headteacher. They invite staff with invite codes and approve students who join with the school code. Roles such as Deputy Head, Bursar, Coach, ICT Administrator, Librarian and Teacher unlock the tools that fit that role.',
    after: 'We do not independently check that someone creating a school is allowed to represent it. School leaders are responsible for who they invite and approve. A blue verified badge means the Schoolink team has checked that person or school.',
  },
  {
    title: 'Parents and family links',
    short: 'Parents',
    lead: 'A parent account can be linked to a child. Once a link is set up, the parent can see that child\'s timetable, homework and published results. A parent cannot see anything else of the child\'s private activity, such as their chats.',
    points: [
      'Links are managed in the app by the people involved and by school staff.',
      'Either side can end a link, and school staff can remove a link that is wrong.',
      'Do not link yourself to a child who is not yours.',
    ],
  },
  {
    title: 'Announcements from Schoolink',
    short: 'Announcements',
    lead: 'The Schoolink team can post announcements to everyone. They appear first in your Home feed, come from "Schoolink" with the verified badge, and disappear after 48 hours.',
    points: [
      'An announcement can have text, photos, videos with sound and files.',
      'They are notices about the service, not advertising. We do not show ads.',
      'The Schoolink name on an announcement is not a profile you can open.',
    ],
  },
  {
    title: 'Acceptable use',
    short: 'Rules',
    lead: 'Be respectful. You agree not to:',
    points: [
      'harass, bully, threaten or impersonate anyone',
      'post anything illegal, sexual, hateful or violent, or content you have no right to share',
      'send spam, scams or repeated unwanted messages',
      'try to break, overload or get around the app, its limits or its security',
      'use someone else\'s account or create accounts to avoid a ban',
    ],
    after: 'School admins can remove members and posts in their school. Community admins manage their own communities. We may remove content, restrict features or suspend accounts that break these rules.',
  },
  {
    title: 'Reports, bans and appeals',
    short: 'Bans & appeals',
    lead: 'You can report posts, comments, messages, community messages, communities and people. Reports are reviewed by the Schoolink moderation team and, for content inside a school, by that school\'s staff.',
    points: [
      'If a report is upheld we may remove the content, limit what an account can do, or ban the account.',
      'If your account is banned you will see a notice with the reason, and you can appeal from that screen.',
      'If you cannot sign in because of a ban, you can send an appeal from the Appeal page linked on the sign-in screen.',
      'Only one appeal can be open at a time. We review it, and you will see the decision when you open the app. If it is turned down you can appeal again after 7 days.',
      'We do not share who made a report.',
    ],
  },
  {
    title: 'Slow-down limits',
    short: 'Limits',
    lead: 'To stop spam and floods, there are limits on how fast one account can post, comment, send messages, add statuses and send reports. If you hit a limit the app tells you to wait a moment, and you can carry on after that.',
    points: [
      'The limits are set high enough for normal use. You can see them in More → Safety and data.',
      'Sending the same message again and again is also blocked.',
      'Trying to get around the limits, or repeated spam, can lead to a restriction or a ban.',
    ],
  },
  {
    title: 'Content you post',
    short: 'Your content',
    lead: 'You keep ownership of what you post, whether text, photos, videos, voice notes or documents. By posting you let other people see it in the way the feature is meant to work, such as your school, a community or the person you are messaging.',
    points: [
      'You can delete your own posts, statuses, comments and messages at any time. Deleting is permanent.',
      'In a community, an admin can remove any message. The chat then shows that a message was removed.',
      'Statuses disappear on their own after 24 hours.',
    ],
  },
  {
    title: 'Communities',
    short: 'Communities',
    lead: 'The person who creates a community is its first admin, and can make others admins, such as teachers or coaches.',
    points: [
      'Admins can add or remove people, change the name, picture and description, choose who can send messages, pin or remove messages, approve messages and approve join requests.',
      'The creator cannot be removed or demoted by other admins.',
      'You can leave a community at any time. If the last admin leaves, the member who joined first becomes an admin.',
    ],
  },
  {
    title: 'School records',
    short: 'Records',
    lead: 'Timetables, homework, marks and report cards are entered by your school. Schoolink is the tool that shows them. The school is responsible for them being right.',
    points: [
      'A mark and feedback on homework are only shown to the student once the teacher returns them.',
      'Questions about a mark or a record should go to the teacher or the school.',
    ],
  },
  {
    title: 'Payments',
    short: 'Payments',
    lead: 'If a Bursar shares a payment link for school fees, the payment is handled entirely by the provider they choose, such as Stripe, PayPal or Paynow. Schoolink does not process or store your card details. Payment problems should go to that provider and your school.',
  },
  {
    title: 'Other services we rely on',
    short: 'Services',
    lead: 'Schoolink runs on Supabase for accounts, database and file storage, and is served from GitHub Pages. It can use Google Sign-In and Google Translate, Firebase for push notifications on Android, and Jitsi Meet for group calls where they are offered. Using those features means your data passes through them as described in the Privacy Policy.',
  },
  {
    title: 'Deleting your account',
    short: 'Deleting',
    lead: 'You can delete your account yourself from the app, whenever you like. This is permanent.',
    points: [
      'Your profile and the things you created are removed or no longer linked to you.',
      'Content that other people need to keep making sense, such as messages in someone else\'s chat, may stay but is no longer tied to your name.',
      'Reports, bans and appeals may be kept where we need them to keep other people safe.',
      'Before you delete, you can download a copy of your data from More → Safety and data.',
      'You can also just leave a school or a community, or delete your own content, without deleting the account.',
    ],
  },
  {
    title: 'Changes to these terms',
    short: 'Changes',
    lead: 'We may update these terms as Schoolink grows. The date at the top shows when they last changed. If you keep using Schoolink after a change, you accept the new terms.',
  },
  {
    title: 'Contact',
    short: 'Contact',
    lead: 'Questions about these terms can be sent from Settings → Help and Feedback.',
  },
]

const summary = [
  'You can look around as a guest, but posting, messaging and following need an account.',
  'Be kind. Reports are reviewed, and people who break the rules can be restricted or banned.',
  'If you are banned you can appeal, and we will look at it.',
  'There are slow-down limits to stop spam.',
  'You own what you post, and you can delete your account or download your data.',
]

export default function TermsOfService() {
  return (
    <LegalDoc
      title="Terms of Service"
      updated="18 October 2026"
      intro="These terms are the rules for using Schoolink. By using the app you agree to them."
      summary={summary}
      sections={sections}
      other={{ label: 'Read the Privacy Policy', to: '/privacy' }}
    />
  )
    }
