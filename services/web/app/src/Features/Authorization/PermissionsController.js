const { ForbiddenError, UserNotFoundError } = require('../Errors/Errors')
const {
  hasPermission,
  getUserCapabilities,
  getUserRestrictions,
} = require('./PermissionsManager')
const ManagedUsersHandler = require('../Subscription/ManagedUsersHandler')

/**
 * Function that returns middleware to add an `assertPermission` function to the request object to check if the user has a specific capability.
 * @returns {Function} The middleware function that adds the `assertPermission` function to the request object.
 */
function useCapabilities() {
  return async function (req, res, next) {
    // attach the user's capabilities to the request object
    req.capabilitySet = new Set()
    // provide a function to assert that a capability is present
    req.assertPermission = capability => {
      if (!req.capabilitySet.has(capability)) {
        throw new ForbiddenError(
          `user does not have permission for ${capability}`
        )
      }
    }
    if (!req.user) {
      return next()
    }
    try {
      // get the group policy applying to the user
      const { groupPolicy, managedBy, isManagedGroupAdmin } =
        await ManagedUsersHandler.promises.getEnrollmentForUser(req.user)
      // attach the subscription ID to the request object
      req.managedBy = managedBy
      // attach the subscription admin status to the request object
      req.isManagedGroupAdmin = isManagedGroupAdmin
      // attach the new capabilities to the request object
      for (const cap of getUserCapabilities(groupPolicy)) {
        req.capabilitySet.add(cap)
      }
      // also attach the user's restrictions (the capabilities they don't have)
      req.userRestrictions = getUserRestrictions(groupPolicy)
      next()
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        // the user is logged in but doesn't exist in the database
        // this can happen if the user has just deleted their account
        return next()
      } else {
        next(error)
      }
    }
  }
}

/**
 * Function that returns middleware to check if the user has permission to access a resource.
 * @param {[string]} requiredCapabilities - the capabilities required to access the resource.
 * @returns {Function} The middleware function that checks if the user has the required capabilities.
 */
function requirePermission(...requiredCapabilities) {
  if (
    requiredCapabilities.length === 0 ||
    requiredCapabilities.some(capability => typeof capability !== 'string')
  ) {
    throw new Error('invalid required capabilities')
  }
  const doRequest = async function (req, res, next) {
    if (!req.user) {
      return next(new Error('no user'))
    }
    try {
      // get the group policy applying to the user
      const { groupPolicy, managedUsersEnabled } =
        await ManagedUsersHandler.promises.getEnrollmentForUser(req.user)

      if (!managedUsersEnabled) {
        return next()
      }
      // check that the user has all the required capabilities
      for (const requiredCapability of requiredCapabilities) {
        // if the user has the permission, continue
        if (!hasPermission(groupPolicy, requiredCapability)) {
          throw new ForbiddenError(
            `user does not have permission for ${requiredCapability}`
          )
        }
      }
      next()
    } catch (error) {
      next(error)
    }
  }
  return doRequest
}

module.exports = {
  requirePermission,
  useCapabilities,
}
