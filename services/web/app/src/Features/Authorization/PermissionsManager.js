/**
 * This module exports functions for managing permissions and policies.
 *
 * It provides a way to:
 *
 * - Register capabilities and policies
 * - Associate policies with custom validators
 * - Apply collections of policies to a user
 * - Check whether a user has a given capability
 * - Check whether a user complies with a given policy
 *
 * Capabilities: boolean values that represent whether a user is allowed to
 * perform a certain action or not. The capabilities are represented as a Set.
 * For example, to delete their account a user would need the
 * `delete-own-account` capability. A user starts with a set of default
 * capabilities that let them do all the things they can currently do in
 * Overleaf.
 *
 * Policy: a rule which specifies which capabilities will be removed from a user
 * when the policy is applied.
 *
 * For example, a policy `userCannotDeleteOwnAccount` is represented as
 * `{'delete-own-account' : false}` meaning that the `delete-own-account`
 * capability will be removed. A policy can remove more than one capability, and
 * more than one policy could apply to a user.
 *
 * Validator: a function that takes an object with user and subscription properties
 * and returns a boolean indicating whether the user satisfies the policy or not.
 * For example, a validator for the `userCannotHaveSecondaryEmail` policy would
 * check whether the user has more than one email address.
 *
 * Group Policies: a collection of policies with a setting indicating whether
 * they are enforced or not. Used to place restrictions on managed users in a
 * group.
 *
 * For example, a group policy could be
 *
 *     {
 *       "userCannotDeleteOwnAccount": true, // enforced
 *       "userCannotHaveSecondaryEmail": false // not enforced
 *     }
 */

const { callbackify } = require('util')
const { ForbiddenError } = require('../Errors/Errors')
const Modules = require('../../infrastructure/Modules')

const POLICY_TO_CAPABILITY_MAP = new Map()
const POLICY_TO_VALIDATOR_MAP = new Map()
const DEFAULT_PERMISSIONS = new Map()

/**
 * Throws an error if the given capability is not registered.
 *
 * @private
 * @param {string} capability - The name of the capability to check.
 * @throws {Error} If the capability is not registered.
 */
function ensureCapabilityExists(capability) {
  if (!DEFAULT_PERMISSIONS.has(capability)) {
    throw new Error(`unknown capability: ${capability}`)
  }
}

/**
 * Registers a new capability with the given name and options.
 *
 * @param {string} name - The name of the capability to register.
 * @param {Object} options - The options for the capability.
 * @param {boolean} options.default - The default value for the capability
 *   (required).
 * @throws {Error} If the default value is not a boolean or if the capability is
 *   already registered.
 */
function registerCapability(name, options) {
  // check that the default value is a boolean
  const defaultValue = options?.default
  if (typeof defaultValue !== 'boolean') {
    throw new Error('default value must be a boolean')
  }
  if (DEFAULT_PERMISSIONS.has(name)) {
    throw new Error(`capability already registered: ${name}`)
  }
  DEFAULT_PERMISSIONS.set(name, defaultValue)
}

/**
 * Registers a new policy with the given name, capabilities, and options.
 *
 * @param {string} name - The name of the policy to register.
 * @param {Object} capabilities - The capabilities for the policy.
 * @param {Object} [options] - The options for the policy.
 * @param {Function?} [options.validator] - The optional validator function for the
 *   policy.
 * @throws {Error} If the policy is already registered or if a capability is not
 *   a boolean or is unknown.
 */
function registerPolicy(name, capabilities, options = {}) {
  const { validator } = options
  // check that the only options provided are capabilities and validators
  // FIXME: maybe use a schema validator here?
  if (POLICY_TO_CAPABILITY_MAP.has(name)) {
    throw new Error(`policy already registered: ${name}`)
  }
  // check that all the entries in the capability set exist and are booleans
  for (const [capabilityName, capabilityValue] of Object.entries(
    capabilities
  )) {
    // check that the capability exists (look in the default permissions)
    if (!DEFAULT_PERMISSIONS.has(capabilityName)) {
      throw new Error(`unknown capability: ${capabilityName}`)
    }
    // check that the value is a boolean
    if (typeof capabilityValue !== 'boolean') {
      throw new Error(
        `capability value must be a boolean: ${capabilityName} = ${capabilityValue}`
      )
    }
  }
  // set the policy capabilities
  POLICY_TO_CAPABILITY_MAP.set(name, new Map(Object.entries(capabilities)))

  // set the policy validator (if present)
  if (validator) {
    POLICY_TO_VALIDATOR_MAP.set(name, validator)
  }
}

/**
 * Returns an array of policy names that are enforced based on the provided
 * group policy object.
 *
 * @private
 * @param {Object} groupPolicy - The group policy object to check.
 * @returns {Array} An array of policy names that are enforced.
 */
function getEnforcedPolicyNames(groupPolicy = {}) {
  if (!groupPolicy) {
    return []
  }
  return Object.keys(
    typeof groupPolicy.toObject === 'function'
      ? groupPolicy.toObject()
      : groupPolicy
  ).filter(
    policyName =>
      !['__v', '_id'].includes(policyName) && groupPolicy[policyName] !== false
  ) // filter out the policies that are not enforced
}

/**
 * Returns the value of the specified capability for the given policy.
 *
 * @private
 * @param {string} policyName - The name of the policy to retrieve the
 *   capability value from.
 * @param {string} capability - The name of the capability to retrieve the value
 *   for.
 * @returns {boolean | undefined} The value of the capability for the policy, or
 *   undefined if the policy or capability is not found.
 */
function getCapabilityValueFromPolicy(policyName, capability) {
  return POLICY_TO_CAPABILITY_MAP.get(policyName)?.get(capability)
}

/**
 * Returns the default value for the specified capability.
 *
 * @private
 * @param {string} capability - The name of the capability to retrieve the
 *   default value for.
 * @returns {boolean | undefined} The default value for the capability, or
 *   undefined if the capability is not found.
 */
function getDefaultPermission(capability) {
  return DEFAULT_PERMISSIONS.get(capability)
}

function getValidatorFromPolicy(policyName) {
  return POLICY_TO_VALIDATOR_MAP.get(policyName)
}

/**
 * Returns a set of default capabilities based on the DEFAULT_PERMISSIONS map.
 *
 * @private
 * @returns {Set} A set of default capabilities.
 */
function getDefaultCapabilities() {
  const defaultCapabilities = new Set()
  for (const [
    capabilityName,
    capabilityValue,
  ] of DEFAULT_PERMISSIONS.entries()) {
    if (capabilityValue === true) {
      defaultCapabilities.add(capabilityName)
    }
  }
  return defaultCapabilities
}

/**
 * Applies a given policy to a set of capabilities, to remove those capabilities
 * which are not allowed by the policy.
 *
 * @private
 * @param {Set} capabilitySet - The set of capabilities to apply the policy to.
 * @param {string} policyName - The name of the policy to apply.
 * @throws {Error} If the policy is unknown.
 */
function applyPolicy(capabilitySet, policyName) {
  const policyCapabilities = POLICY_TO_CAPABILITY_MAP.get(policyName)
  if (!policyCapabilities) {
    throw new Error(`unknown policy: ${policyName}`)
  }
  for (const [
    capabilityName,
    capabilityValue,
  ] of policyCapabilities.entries()) {
    if (capabilityValue !== true) {
      capabilitySet.delete(capabilityName)
    }
  }
}

/**
 * Returns a set of capabilities that a user has based on their group policy.
 *
 * @param {Object} groupPolicy - The group policy object to check.
 * @returns {Set} A set of capabilities that the user has, based on their group
 *   policy.
 * @throws {Error} If the policy is unknown.
 */
function getUserCapabilities(groupPolicy) {
  const userCapabilities = getDefaultCapabilities()
  const enforcedPolicyNames = getEnforcedPolicyNames(groupPolicy)
  for (const enforcedPolicyName of enforcedPolicyNames) {
    applyPolicy(userCapabilities, enforcedPolicyName)
  }
  return userCapabilities
}

/**
 * Returns a set of capabilities that a user does not have based on their group policy.
 *
 * @param {Object} groupPolicy - The group policy object to check.
 * @returns {Set} A set of capabilities that the user does not have, based on their group
 *   policy.
 * @throws {Error} If the policy is unknown.
 */
function getUserRestrictions(groupPolicy) {
  const userCapabilities = getUserCapabilities(groupPolicy)
  const userRestrictions = getDefaultCapabilities()
  for (const capability of userCapabilities) {
    userRestrictions.delete(capability)
  }
  return userRestrictions
}

/**
 * Checks if a user has permission for a given capability based on their group
 * policy.
 *
 * @param {Object} groupPolicy - The group policy object for the user.
 * @param {string} capability - The name of the capability to check permission
 *   for.
 * @returns {boolean} True if the user has permission for the capability, false
 *   otherwise.
 * @throws {Error} If the capability does not exist.
 */
function hasPermission(groupPolicy, capability) {
  ensureCapabilityExists(capability)
  // look through all the entries in the group policy and see if any of them apply to the capability
  const results = getEnforcedPolicyNames(groupPolicy).map(userPolicyName =>
    getCapabilityValueFromPolicy(userPolicyName, capability)
  )
  // if there are no results, or none of the policies apply, return the default permission
  if (results.length === 0 || results.every(result => result === undefined)) {
    return getDefaultPermission(capability)
  }
  // only allow the permission if all the results are true, otherwise deny it
  return results.every(result => result === true)
}

/**
 * Asynchronously checks which policies a user complies with using the
 * applicable validators. Each validator is an async function that takes an object
 * with user, groupPolicy, and subscription properties and returns a boolean.
 *
 * @param {Object} options - The options object.
 * @param {Object} options.user - The user object to check.
 * @param {Object} options.groupPolicy - The group policy object to check.
 * @param {Object} options.subscription - The subscription object for the group policy.
 * @returns {Promise<Map>} A promise that resolves with a Map object containing
 *   the validation status for each enforced policy. The keys of the Map are the
 *   enforced policy names, and the values are booleans indicating whether the
 *   user complies with the policy.
 */
async function getUserValidationStatus({ user, groupPolicy, subscription }) {
  // find all the enforced policies for the user
  const enforcedPolicyNames = getEnforcedPolicyNames(groupPolicy)
  // for each enforced policy, we have a list of capabilities with expected values
  // some of those capabilities have validators
  // we need to run the validators and the result to see if if the user is complies with the policy
  const userValidationStatus = new Map()
  for (const enforcedPolicyName of enforcedPolicyNames) {
    const validator = getValidatorFromPolicy(enforcedPolicyName)
    if (validator) {
      userValidationStatus.set(
        enforcedPolicyName,
        await validator({ user, subscription })
      )
    }
  }
  return userValidationStatus
}

/**
 * Checks if a user has permission for a given set of capabilities
 *
 * @param {Object} user - The user object to retrieve the group policy for.
 *   Only the user's _id is required
 * @param {Array} capabilities - The list of the capabilities to check permission for.
 * @returns {Promise<void>}
 * @throws {Error} If the user does not have permission
 */
async function checkUserPermissions(user, requiredCapabilities) {
  const result =
    (
      await Modules.promises.hooks.fire(
        'getManagedUsersEnrollmentForUser',
        user
      )
    )[0] || {}
  const { groupPolicy, managedUsersEnabled } = result
  if (!managedUsersEnabled) {
    return
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
}

module.exports = {
  registerCapability,
  registerPolicy,
  hasPermission,
  getUserCapabilities,
  getUserRestrictions,
  getUserValidationStatus: callbackify(getUserValidationStatus),
  promises: { checkUserPermissions, getUserValidationStatus },
}
