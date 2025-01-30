const { ForbiddenError, UserNotFoundError } = require('../Errors/Errors')
const {
  getUserCapabilities,
  getUserRestrictions,
  combineGroupPolicies,
  combineAllowedProperties,
} = require('./PermissionsManager')
const { assertUserPermissions } = require('./PermissionsManager').promises
const Modules = require('../../infrastructure/Modules')
const { expressify } = require('@overleaf/promise-utils')
const Features = require('../../infrastructure/Features')

/**
 * Function that returns middleware to add an `assertPermission` function to the request object to check if the user has a specific capability.
 * @returns {Function} The middleware function that adds the `assertPermission` function to the request object.
 */
function useCapabilities() {
  const middleware = async function (req, res, next) {
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
      let results = await Modules.promises.hooks.fire(
        'getGroupPolicyForUser',
        req.user
      )
      // merge array of all results from all modules
      results = results.flat()

      if (results.length > 0) {
        // get the combined group policy applying to the user
        const groupPolicies = results.map(result => result.groupPolicy)
        const combinedGroupPolicy = combineGroupPolicies(groupPolicies)
        // attach the new capabilities to the request object
        for (const cap of getUserCapabilities(combinedGroupPolicy)) {
          req.capabilitySet.add(cap)
        }
        // also attach the user's restrictions (the capabilities they don't have)
        req.userRestrictions = getUserRestrictions(combinedGroupPolicy)

        // attach allowed properties to the request object
        const allowedProperties = combineAllowedProperties(results)
        for (const [prop, value] of Object.entries(allowedProperties)) {
          req[prop] = value
        }
      }
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
  return expressify(middleware)
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
    if (!Features.hasFeature('saas')) {
      return next()
    }
    if (!req.user) {
      return next(new Error('no user'))
    }
    try {
      await assertUserPermissions(req.user, requiredCapabilities)
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
