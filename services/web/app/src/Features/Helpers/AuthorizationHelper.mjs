import { UserSchema } from '../../models/User.mjs'

export default {
  hasAnyStaffAccess,
}

function hasAnyStaffAccess(user) {
  if (!user.staffAccess) {
    return false
  }

  for (const key of Object.keys(UserSchema.obj.staffAccess)) {
    if (user.staffAccess[key]) return true
  }
  return false
}
