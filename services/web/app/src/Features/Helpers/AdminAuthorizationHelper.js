const Settings = require('@overleaf/settings')
const Modules = require('../../infrastructure/Modules')
const { expressify } = require('@overleaf/promise-utils')
const SessionManager = require('../Authentication/SessionManager')
const logger = require('@overleaf/logger')

module.exports = {
  hasAdminAccess,
  canRedirectToAdminDomain,
  getAdminCapabilities,
  addHasAdminCapabilityToLocals: expressify(addHasAdminCapabilityToLocals),
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

async function addHasAdminCapabilityToLocals(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  try {
    const { adminCapabilities, adminCapabilitiesAvailable } =
      await getAdminCapabilities(user)
    res.locals.hasAdminCapability = capability => {
      if (!hasAdminAccess(user)) {
        return false
      }
      if (!adminCapabilitiesAvailable) {
        // If admin capabilities are not available, then all admins have all capabilities
        return true
      }
      return adminCapabilities.includes(capability)
    }
  } catch (error) {
    if (user) {
      // This is unexpected, it probably means that the session user does not exist.
      logger.warn({ error, req, user }, 'Failed to get admin capabilities')
    }
    // A module probably threw so adminCapabilitiesAvailable should be true if we are here so deny to be safe
    res.locals.hasAdminCapability = () => false
  }
  next()
}

function canRedirectToAdminDomain(user) {
  if (Settings.adminPrivilegeAvailable) return false
  if (!Settings.adminUrl) return false
  if (!user) return false
  return Boolean(user.isAdmin)
}
