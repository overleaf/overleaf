const Settings = require('@overleaf/settings')

module.exports = {
  hasAdminAccess,
  canRedirectToAdminDomain,
}

function hasAdminAccess(user) {
  if (!Settings.adminPrivilegeAvailable) return false
  if (!user) return false
  return Boolean(user.isAdmin)
}

function canRedirectToAdminDomain(user) {
  if (Settings.adminPrivilegeAvailable) return false
  if (!Settings.adminUrl) return false
  if (!user) return false
  return Boolean(user.isAdmin)
}
