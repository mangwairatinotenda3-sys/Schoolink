import { Mail, HelpCircle } from 'lucide-react'
import BackHeader from '../components/BackHeader.jsx'

const faqs = [
  { q: 'How do I join my school?', a: 'Ask your Headteacher, Deputy, or Bursar for an invite code (staff) or the student join code, then enter it during sign-up under Settings or the account type screen.' },
  { q: 'Why can\'t I post?', a: 'Only school staff members who have joined a school can post. Guests, parents, and investors can browse, like, comment, and follow.' },
  { q: 'How do I become Headteacher?', a: 'The first person to create a school automatically becomes its Headteacher.' },
]

export default function HelpSettings() {
  return (
    <div className="flex-1 flex flex-col">
      <BackHeader title="Help and Feedback" />
      <div className="flex-1 flex flex-col px-6 pt-4">
        <div className="space-y-4">
          {faqs.map((f) => (
            <div key={f.q} className="flex gap-3">
              <HelpCircle size={16} className="text-brand-purple shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">{f.q}</p>
                <p className="text-xs text-gray-500 mt-1">{f.a}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="h-px bg-gray-100 my-5" />

        <a
          href="mailto:support@schoolink.app"
          className="w-full flex items-center justify-center gap-2 bg-brand-purple text-white rounded-xl py-3 text-sm font-medium"
        >
          <Mail size={16} /> Contact Support
        </a>
      </div>
    </div>
  )
    }
