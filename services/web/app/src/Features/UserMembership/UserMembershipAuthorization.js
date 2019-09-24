let UserMembershipAuthorization = {
  hasStaffAccess(requiredStaffAccess) {
    return req => {
      if (!req.user) {
        return false
      }
      if (req.user.isAdmin) {
        return true
      }
      return (
        requiredStaffAccess &&
        req.user.staffAccess &&
        req.user.staffAccess[requiredStaffAccess]
      )
    }
  },

  hasEntityAccess() {
    return req => {
      if (!req.entity) {
        return false
      }
      return req.entity[req.entityConfig.fields.access].some(accessUserId =>
        accessUserId.equals(req.user._id)
      )
    }
  }
}
module.exports = UserMembershipAuthorization
