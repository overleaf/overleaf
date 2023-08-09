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
