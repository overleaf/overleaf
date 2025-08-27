const {
  hasAdminCapability,
  hasAdminAccess,
} = require('../Helpers/AdminAuthorizationHelper')
const SessionManager = require('../Authentication/SessionManager')
const Settings = require('@overleaf/settings')

const UserMembershipAuthorization = {
  hasStaffAccess(requiredStaffAccess) {
    return req => {
      if (!req.user) {
        return false
      }
      return (
        requiredStaffAccess &&
        req.user.staffAccess &&
        req.user.staffAccess[requiredStaffAccess]
      )
    }
  },

  hasAdminCapability,

  hasAnyAdminRole(req) {
    return (
      Settings.adminRolesEnabled &&
      hasAdminAccess(SessionManager.getSessionUser(req.session))
    )
  },

  hasModifyGroupMemberCapability(req, res) {
    return hasAdminCapability(
      req.entity.managedUsersEnabled
        ? 'modify-managed-group-member'
        : 'modify-group-member',
      true
    )(req, res)
  },

  hasEntityAccess() {
    return req => {
      if (!req.entity) {
        return false
      }
      const fieldAccess = req.entity[req.entityConfig.fields.access]
      const fieldAccessArray = Array.isArray(fieldAccess)
        ? fieldAccess
        : [fieldAccess.toString()]
      return fieldAccessArray.some(
        accessUserId => accessUserId.toString() === req.user._id.toString()
      )
    }
  },
}
module.exports = UserMembershipAuthorization
