const { callbackify } = require('util')
const { Subscription } = require('../../models/Subscription')
const { GroupPolicy } = require('../../models/GroupPolicy')
const { User } = require('../../models/User')
const ManagedUsersPolicy = require('./ManagedUsersPolicy')
const OError = require('@overleaf/o-error')
const {
  UserNotFoundError,
  SubscriptionNotFoundError,
} = require('../Errors/Errors')

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
async function getGroupPolicyForUser(requestedUser) {
  // Don't rely on the user being populated, it may be a session user without
  // the enrollment property. Force the user to be loaded from mongo.
  const user = await User.findById(requestedUser._id, 'enrollment')
  if (!user) {
    throw new UserNotFoundError({ info: { userId: requestedUser._id } })
  }
  // Now we are sure the user exists and we have the full contents
  if (user.enrollment?.managedBy == null) {
    return
  }
  // retrieve the subscription and the group policy (without the _id field)
  const subscription = await Subscription.findById(user.enrollment.managedBy)
    .populate('groupPolicy', '-_id')
    .exec()
  if (!subscription) {
    throw new SubscriptionNotFoundError({
      info: { subscriptionId: user.enrollment.managedBy, userId: user._id },
    })
  }
  // return the group policy as a plain object (without the __v field)
  const groupPolicy = subscription.groupPolicy.toObject({
    versionKey: false,
  })
  return groupPolicy
}

async function enrollInSubscription(userId, subscription) {
  // check whether the user is already enrolled in a subscription
  const user = await User.findOne({
    _id: userId,
    'enrollment.managedBy': { $exists: true },
  }).exec()
  if (user != null) {
    throw new OError('User is already enrolled in a subscription', {
      userId,
      subscriptionId: subscription._id,
    })
  }
  // update the user to be enrolled in the subscription
  const updatedUser = await User.findOneAndUpdate(
    { _id: userId, 'enrollment.managedBy': { $exists: false } },
    {
      enrollment: {
        managedBy: subscription._id,
        enrolledAt: new Date(),
      },
    },
    { new: true }
  ).exec()
  // check whether the enrollment succeeded
  if (
    !updatedUser ||
    !subscription.equals(updatedUser?.enrollment?.managedBy)
  ) {
    throw new OError('Failed to enroll user in subscription', {
      userId,
      subscriptionId: subscription._id,
    })
  }
}

module.exports = {
  promises: {
    enableManagedUsers,
    getGroupPolicyForUser,
    enrollInSubscription,
  },
  enableManagedUsers: callbackify(enableManagedUsers),
  getGroupPolicyForUser: callbackify(getGroupPolicyForUser),
  enrollInSubscription: callbackify(enrollInSubscription),
}
