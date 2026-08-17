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

// Staff = an active school member who isn't a Student. Used to gate
// dashboards/tools that shouldn't be visible to students, guests,
// parents, investors, or followers.
export function isStaffMember(profile) {
  return isSchoolMember(profile) && profile?.role !== 'Student'
}

export function canManageStaff(profile) {
  return isSchoolMember(profile) && ['Headteacher', 'Deputy Head'].includes(profile?.role)
}

export function isHeadteacher(profile) {
  return profile?.role === 'Headteacher'
}

export function canManageLibrary(profile) {
  return isSchoolMember(profile) && ['Librarian', 'Headteacher', 'Deputy Head', 'ICT Administrator'].includes(profile?.role)
}

export function canManageFees(profile) {
  return isSchoolMember(profile) && ['Bursar', 'Headteacher', 'Deputy Head'].includes(profile?.role)
}

export function canManageSports(profile) {
  return isSchoolMember(profile) && ['School Coach', 'Headteacher', 'Deputy Head'].includes(profile?.role)
}

export function canManageDevices(profile) {
  return isSchoolMember(profile) && ['ICT Administrator', 'Headteacher', 'Deputy Head'].includes(profile?.role)
                                     }
