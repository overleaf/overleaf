const { UserSchema } = require('../../models/User')
const { hasAdminAccess } = require('./AdminAuthorizationHelper')

module.exports = {
  hasAnyStaffAccess,
}

function hasAnyStaffAccess(user) {
  if (hasAdminAccess(user)) {
    return true
  }
  if (!user.staffAccess) {
    return false
  }

  for (const key of Object.keys(UserSchema.obj.staffAccess)) {
    if (user.staffAccess[key]) return true
  }
  return false
}
