const { callbackify } = require('util')
const { Subscription } = require('../../models/Subscription')
const { GroupPolicy } = require('../../models/GroupPolicy')
const { User } = require('../../models/User')
const ManagedUsersPolicy = require('./ManagedUsersPolicy')
const OError = require('@overleaf/o-error')
const settings = require('@overleaf/settings')
const {
  UserNotFoundError,
  SubscriptionNotFoundError,
} = require('../Errors/Errors')
const UserGetter = require('../User/UserGetter')
const UserUpdater = require('../User/UserUpdater')
const EmailHandler = require('../Email/EmailHandler')
const logger = require('@overleaf/logger')

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

  await _sendEmailToGroupMembers(subscriptionId)
}

/**
 * Disables managed users for a given subscription by removing the
 * group policy and deleting enrolment information for all managed users.
 * @async
 * @function
 * @param {string} subscriptionId - The ID of the subscription to disable
 *   managed users for.
 * @returns {Promise<void>} - A Promise that resolves when the subscription and
 *   users have been updated.
 */
async function disableManagedUsers(subscriptionId) {
  const subscription = await Subscription.findById(subscriptionId).exec()

  for (const userId of subscription.member_ids || []) {
    const user = await UserGetter.promises.getUser(userId, { enrollment: 1 })
    if (
      user.enrollment?.managedBy?.toString() === subscription._id.toString()
    ) {
      await UserUpdater.promises.updateUser(userId, {
        $unset: { enrollment: 1 },
      })
    }
  }

  subscription.groupPolicy = undefined
  await subscription.save()
}

/**
 * Retrieves the group policy for a user enrolled in a managed group.
 * @async
 * @function
 * @param {Object} requestedUser - The user object to retrieve the group policy for.
 * @returns {Promise<Object>} - A Promise that resolves with the group policy
 *   and subscription objects for the user's enrollment, or null if it does not exist.
 */
async function getEnrollmentForUser(requestedUser) {
  // Don't rely on the user being populated, it may be a session user without
  // the enrollment property. Force the user to be loaded from mongo.
  const user = await User.findById(requestedUser._id, 'enrollment')
  if (!user) {
    throw new UserNotFoundError({ info: { userId: requestedUser._id } })
  }
  // Now we are sure the user exists and we have the full contents
  if (user.enrollment?.managedBy == null) {
    return {}
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

  // check whether the user is an admin of the subscription
  const isManagedGroupAdmin = user._id.equals(subscription.admin_id)

  // return the group policy as a plain object (without the __v field)
  const groupPolicy = subscription.groupPolicy.toObject({
    versionKey: false,
  })

  return {
    groupPolicy,
    managedBy: user.enrollment.managedBy,
    isManagedGroupAdmin,
  }
}

async function enrollInSubscription(userId, subscription) {
  // check whether the user is already enrolled in a subscription
  const user = await User.findOne(
    {
      _id: userId,
      'enrollment.managedBy': { $exists: true },
    },
    { _id: 1 }
  ).exec()
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

/**
 * Send email to all group members, irregardless of the member status.
 * @async
 * @function
 * @param {string} subscriptionId - The ID of the subscription to enable
 *   managed users for.
 * @returns {Promise<void>} - A Promise that resolves when all the `sendEmail` function has been sent,
 * irregardless of whether they're successful or failed.
 */
async function _sendEmailToGroupMembers(subscriptionId) {
  const EMAIL_DELAY_IN_MS = 0

  const subscription = await Subscription.findById(subscriptionId)
    .populate('member_ids', 'email')
    .populate('admin_id', ['first_name', 'last_name', 'email'])
    .exec()

  // On failure, log the error and carry on so that one email failing does not prevent other emails sending
  for (const recipient of subscription.member_ids) {
    try {
      const opts = {
        to: recipient.email,
        admin: subscription.admin_id,
        groupName: subscription.teamName,
        acceptInviteUrl: `${settings.siteUrl}/subscription/${subscriptionId}/enrollment/`,
      }
      EmailHandler.sendDeferredEmail(
        'surrenderAccountForManagedUsers',
        opts,
        EMAIL_DELAY_IN_MS
      )
    } catch (err) {
      logger.error(
        { err, userId: recipient._id },
        'could not send notification email to surrender account'
      )
    }
  }
}

module.exports = {
  promises: {
    enableManagedUsers,
    disableManagedUsers,
    getEnrollmentForUser,
    enrollInSubscription,
  },
  enableManagedUsers: callbackify(enableManagedUsers),
  getEnrollmentForUser: callbackify(getEnrollmentForUser),
  enrollInSubscription: callbackify(enrollInSubscription),
  disableManagedUsers: callbackify(disableManagedUsers),
}
