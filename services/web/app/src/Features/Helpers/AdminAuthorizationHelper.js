const Settings = require('@overleaf/settings')
const Modules = require('../../infrastructure/Modules')

module.exports = {
  hasAdminAccess,
  canRedirectToAdminDomain,
  getAdminCapabilities,
}

function hasAdminAccess(user) {
  if (!Settings.adminPrivilegeAvailable) return false
  if (!user) return false
  return Boolean(user.isAdmin)
}

async function getAdminCapabilities(user) {
  const rawAdminCapabilties = await Modules.promises.hooks.fire(
    'getAdminCapabilities',
    user
  )

  return {
    adminCapabilities: [...new Set(rawAdminCapabilties.flat())],
    adminCapabilitiesAvailable: rawAdminCapabilties.length > 0,
  }
}

function canRedirectToAdminDomain(user) {
  if (Settings.adminPrivilegeAvailable) return false
  if (!Settings.adminUrl) return false
  if (!user) return false
  return Boolean(user.isAdmin)
}
