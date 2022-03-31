const { UserSchema } = require('../../models/User')

module.exports = {
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
