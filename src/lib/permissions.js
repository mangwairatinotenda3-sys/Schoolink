// Central place for role checks so every screen uses the same rules.

export function isSchoolMember(profile) {
  return (
    profile?.account_type === 'school_member' &&
    !!profile?.school_id &&
    profile?.status === 'active'
  )
}

export function isPendingApproval(profile) {
  return profile?.account_type === 'school_member' && profile?.status === 'pending'
}

export function canManageStaff(profile) {
  return isSchoolMember(profile) && ['Headteacher', 'Deputy Head'].includes(profile?.role)
}

export function isHeadteacher(profile) {
  return profile?.role === 'Headteacher'
}
