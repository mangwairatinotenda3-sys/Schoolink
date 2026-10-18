import LegalDoc from '../components/LegalDoc.jsx'

const sections = [
  {
    title: 'What we collect',
    short: 'Collected',
    lead: 'We collect what we need to run the app.',
    points: [
      'Account: your email, and for Google Sign-In your name and profile photo. Guests have no email at all.',
      'Profile: your name, username, bio, location, links, avatar and cover photos, role, school and class.',
      'Content: posts, statuses, comments, messages, voice notes, photos, videos and documents you upload.',
      'School records: timetable entries, homework you hand in, marks and feedback, and results your school publishes.',
      'Family links: who is linked as a parent or child.',
      'Activity: who you follow, the communities you are in, your online status, notifications, and a login history with the method and time.',
      'Safety: reports you make, reports about content, ban status and appeals.',
      'Device: a notification token so we can send push notifications to your phone.',
    ],
  },
  {
    title: 'What we do not collect',
    short: 'Not collected',
    lead: 'We do not collect payment card details. Payments happen on the provider\'s own page through links your Bursar shares. We do not ask for health records, government ID numbers or financial account numbers.',
  },
  {
    title: 'Guests',
    short: 'Guests',
    lead: 'When you continue as a guest we create an anonymous account with no email and no name. It lets you browse, search and read updates. We keep a basic record for that account so the app works, and it can be deleted if the guest account is no longer used.',
  },
  {
    title: 'Children and parents',
    short: 'Children',
    lead: 'Schoolink is used by students, including children, as part of a school\'s supervised community. A student account is created with a school code and needs admin approval before it is active.',
    points: [
      'A parent can see a linked child\'s timetable, homework and published results. They cannot read the child\'s chats.',
      'Schools and parents decide whether a student\'s use is right. We suggest schools go through this policy with families.',
    ],
  },
  {
    title: 'How we use your data',
    short: 'Use',
    lead: 'We use it to run the features you use: your feed, notifications, chats, communities and school tools. We use it to keep the platform safe, and to let other people see the profile details you have chosen to share.',
    points: [
      'We do not sell your data, and we do not use it for advertising. There are no ads in Schoolink.',
      'Announcements from Schoolink are notices about the service, not ads.',
    ],
  },
  {
    title: 'Who can see what',
    short: 'Visibility',
    points: [
      'Private messages can only be read by the two people in the chat.',
      'Posts and statuses are shown to the audience that feature is meant for, such as your school.',
      'Community messages are visible to the members of that community. Community admins can remove messages.',
      'Reports and appeals can be seen by the Schoolink moderation team. Reports about content inside a school can also be seen by that school\'s staff.',
      'Homework marks and feedback stay hidden from the student until the teacher returns them.',
    ],
  },
  {
    title: 'Safety checks and limits',
    short: 'Safety',
    lead: 'To keep Schoolink safe we count how often an account posts, comments, messages and reports, so we can apply slow-down limits. A simple word filter checks posts for abusive words. We do not read private messages to do this.',
    after: 'If an account is banned, we keep the ban, the reason and any appeal so that the decision can be reviewed.',
  },
  {
    title: 'Download your data',
    short: 'Your copy',
    lead: 'You can download a copy of your data at any time from More → Safety and data. It is a file with your profile, posts, comments, statuses, messages you sent and received, saved items, follows, communities, notifications, login history and your reports and appeals.',
    points: [
      'It does not include things that belong to your school, such as marks, report cards and counselling or fee records. Ask your school for those.',
      'Photos and videos are included as links to the files.',
      'The file is made on your device when you ask for it. Keep it safe, because anyone who has it can read it.',
    ],
  },
  {
    title: 'Deleting your account',
    short: 'Deleting',
    lead: 'You can delete your account yourself from the app. Your profile and the things you created are removed or no longer linked to you.',
    points: [
      'Messages in other people\'s chats may remain, but are no longer tied to your name.',
      'Reports, bans and appeals may be kept where they are needed to protect other people.',
      'You can also edit or remove your profile details, delete your own content, block people, hide read receipts and turn off notification types one by one.',
    ],
  },
  {
    title: 'Where your data lives',
    short: 'Storage',
    lead: 'Your data is stored and processed by Supabase for the database, sign-in and file storage, and the app is served from GitHub Pages. If you use Google Sign-In or Google Translate, Google handles that data under its own policy. Push notifications on Android go through Firebase. Group calls run on Jitsi Meet\'s public servers and are not stored by Schoolink.',
  },
  {
    title: 'Cookies and local storage',
    short: 'Cookies',
    lead: 'We use your browser\'s local storage to remember your last email if you turn on Remember me, your language and your display choices. Google Translate sets its own cookie when it is on. We do not use tracking or advertising cookies.',
  },
  {
    title: 'Security',
    short: 'Security',
    lead: 'Access to your data is controlled by rules in the database. For example, private messages can only be read by the two people in the chat, and school tools are limited to that school\'s members. No system is perfectly safe. Use a strong password and turn on Two-Factor Authentication in Settings.',
  },
  {
    title: 'Changes to this policy',
    short: 'Changes',
    lead: 'We may change this policy as the app changes. The date at the top shows the latest update.',
  },
  {
    title: 'Contact',
    short: 'Contact',
    lead: 'Questions about your data or this policy can be sent from Settings → Help and Feedback.',
  },
]

const summary = [
  'We collect what the app needs to work, and we never sell it or use it for ads.',
  'Private messages are only readable by the two people in the chat.',
  'Parents see a linked child\'s timetable, homework and results, not their chats.',
  'You can download a copy of your data, or delete your account, from the app.',
  'If you are banned we keep the decision so you can appeal it.',
]

export default function PrivacyPolicy() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated="18 October 2026"
      intro="This policy explains what Schoolink collects, why, and what you can do about it."
      summary={summary}
      sections={sections}
      other={{ label: 'Read the Terms of Service', to: '/terms' }}
    />
  )
      }
