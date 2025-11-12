import { UserSchema } from '../../models/User.js'

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
