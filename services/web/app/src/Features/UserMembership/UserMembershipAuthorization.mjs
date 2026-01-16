import AdminAuthorizationHelper from '../Helpers/AdminAuthorizationHelper.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'

const UserMembershipAuthorization = {
  hasAdminCapability: AdminAuthorizationHelper.hasAdminCapability,

  hasAdminAccess(req) {
    return AdminAuthorizationHelper.hasAdminAccess(
      SessionManager.getSessionUser(req.session)
    )
  },

  hasModifyGroupMemberCapability(req, res) {
    return AdminAuthorizationHelper.hasAdminCapability(
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
export default UserMembershipAuthorization
