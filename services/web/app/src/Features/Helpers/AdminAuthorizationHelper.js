const Settings = require('@overleaf/settings')

module.exports = {
  hasAdminAccess,
}

function hasAdminAccess(user) {
  if (!Settings.adminPrivilegeAvailable) return false
  if (!user) return false
  return Boolean(user.isAdmin)
}
