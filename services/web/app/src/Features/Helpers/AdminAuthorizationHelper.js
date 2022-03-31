const Settings = require('@overleaf/settings')

module.exports = {
  hasAdminAccess,
  shouldRedirectToAdminPanel,
}

function hasAdminAccess(user) {
  if (!Settings.adminPrivilegeAvailable) return false
  if (!user) return false
  return Boolean(user.isAdmin)
}

function shouldRedirectToAdminPanel(user) {
  if (Settings.adminPrivilegeAvailable) return false
  if (!user) return false
  return Boolean(user.isAdmin)
}
