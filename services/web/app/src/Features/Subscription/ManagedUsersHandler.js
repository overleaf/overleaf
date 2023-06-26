const { callbackify } = require('util')
const { Subscription } = require('../../models/Subscription')
const { GroupPolicy } = require('../../models/GroupPolicy')
const ManagedUsersPolicy = require('./ManagedUsersPolicy')

/**
 * This module contains functions for handling managed users in a
 * group subscription.
 */

/**
 * Enables managed users for a given subscription by creating a new
 * group policy with default settings for managed users and updating
 * the subscription to use the new policy.
 * @async
 * @function
 * @param {string} subscriptionId - The ID of the subscription to enable
 *   managed users for.
 * @returns {Promise<void>} - A Promise that resolves when the subscription
 *   has been updated with the new group policy.
 */
async function enableManagedUsers(subscriptionId) {
  const subscription = await Subscription.findById(subscriptionId).exec()
  // create a new Group policy with the default settings for managed users
  const policy = ManagedUsersPolicy.getDefaultPolicy()
  const groupPolicy = new GroupPolicy(policy)
  await groupPolicy.save()
  // update the subscription to use the new policy
  subscription.groupPolicy = groupPolicy._id
  await subscription.save()
}

/**
 * Retrieves the group policy for a user enrolled in a managed group.
 * @async
 * @function
 * @param {Object} user - The user object to retrieve the group policy for.
 * @returns {Promise<Object>} - A Promise that resolves with the group policy
 *   object for the user's enrollment, or undefined if it does not exist.
 */
async function getGroupPolicyForUser(user) {
  if (user.enrollment?.managedBy == null) {
    return
  }
  const subscription = await Subscription.findById(user.enrollment.managedBy)
    .populate('groupPolicy', '-_id')
    .exec()
  // return the group policy as a plain object without the _id and __v field
  const groupPolicy = subscription?.groupPolicy.toObject({
    versionKey: false,
  })
  return groupPolicy
}

module.exports = {
  promises: {
    enableManagedUsers,
    getGroupPolicyForUser,
  },
  enableManagedUsers: callbackify(enableManagedUsers),
  getGroupPolicyForUser: callbackify(getGroupPolicyForUser),
}
