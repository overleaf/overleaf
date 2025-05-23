const { callbackify } = require('util')
const logger = require('@overleaf/logger')
const moment = require('moment')
const { User } = require('../../models/User')
const { DeletedUser } = require('../../models/DeletedUser')
const { UserAuditLogEntry } = require('../../models/UserAuditLogEntry')
const { Feedback } = require('../../models/Feedback')
const NewsletterManager = require('../Newsletter/NewsletterManager')
const ProjectDeleter = require('../Project/ProjectDeleter')
const SubscriptionHandler = require('../Subscription/SubscriptionHandler')
const SubscriptionUpdater = require('../Subscription/SubscriptionUpdater')
const SubscriptionLocator = require('../Subscription/SubscriptionLocator')
const UserMembershipsHandler = require('../UserMembership/UserMembershipsHandler')
const UserSessionsManager = require('./UserSessionsManager')
const UserAuditLogHandler = require('./UserAuditLogHandler')
const InstitutionsAPI = require('../Institutions/InstitutionsAPI')
const Modules = require('../../infrastructure/Modules')
const Errors = require('../Errors/Errors')
const OnboardingDataCollectionManager = require('../OnboardingDataCollection/OnboardingDataCollectionManager')
const EmailHandler = require('../Email/EmailHandler')

module.exports = {
  deleteUser: callbackify(deleteUser),
  deleteMongoUser: callbackify(deleteMongoUser),
  expireDeletedUser: callbackify(expireDeletedUser),
  ensureCanDeleteUser: callbackify(ensureCanDeleteUser),
  expireDeletedUsersAfterDuration: callbackify(expireDeletedUsersAfterDuration),

  promises: {
    deleteUser,
    deleteMongoUser,
    expireDeletedUser,
    ensureCanDeleteUser,
    expireDeletedUsersAfterDuration,
  },
}

async function deleteUser(userId, options) {
  if (!userId) {
    logger.warn('user_id is null when trying to delete user')
    throw new Error('no user_id')
  }

  try {
    const user = await User.findById(userId).exec()
    logger.info({ userId }, 'deleting user')
    await ensureCanDeleteUser(user)
    logger.info({ userId }, 'cleaning up user')
    await _cleanupUser(user)
    logger.info({ userId }, 'firing deleteUser hook')
    await Modules.promises.hooks.fire('deleteUser', userId)
    logger.info({ userId }, 'adding delete-account audit log entry')
    await UserAuditLogHandler.promises.addEntry(
      userId,
      'delete-account',
      options.deleterUser ? options.deleterUser._id : userId,
      options.ipAddress
    )
    logger.info({ userId }, 'creating deleted user record')
    await _createDeletedUser(user, options)
    logger.info({ userId }, 'deleting user projects')
    await ProjectDeleter.promises.deleteUsersProjects(user._id)
    if (options.skipEmail) {
      logger.info({ userId }, 'skipping sending deletion email to user')
    } else {
      logger.info({ userId }, 'sending deletion email to user')
      await _sendDeleteEmail(user, options.force)
    }
    logger.info({ userId }, 'deleting user record')
    await deleteMongoUser(user._id)
    logger.info({ userId }, 'user deletion complete')
  } catch (error) {
    logger.warn({ error, userId }, 'something went wrong deleting the user')
    throw error
  }
}

/**
 * delete a user document only
 */
async function deleteMongoUser(userId) {
  if (!userId) {
    throw new Error('no user_id')
  }

  await User.deleteOne({ _id: userId }).exec()
}

async function expireDeletedUser(userId) {
  await Modules.promises.hooks.fire('expireDeletedUser', userId)
  const deletedUser = await DeletedUser.findOne({
    'deleterData.deletedUserId': userId,
  }).exec()

  await Feedback.deleteMany({ userId }).exec()
  await OnboardingDataCollectionManager.deleteOnboardingDataCollection(userId)

  deletedUser.user = undefined
  deletedUser.deleterData.deleterIpAddress = undefined
  await deletedUser.save()
}

async function expireDeletedUsersAfterDuration() {
  const DURATION = 90
  const deletedUsers = await DeletedUser.find({
    'deleterData.deletedAt': {
      $lt: new Date(moment().subtract(DURATION, 'days')),
    },
    user: { $type: 'object' },
  }).exec()

  if (deletedUsers.length === 0) {
    return
  }

  for (let i = 0; i < deletedUsers.length; i++) {
    const deletedUserId = deletedUsers[i].deleterData.deletedUserId
    await expireDeletedUser(deletedUserId)
    await UserAuditLogEntry.deleteMany({ userId: deletedUserId }).exec()
  }
}

async function ensureCanDeleteUser(user) {
  const subscription =
    await SubscriptionLocator.promises.getUsersSubscription(user)
  if (subscription) {
    throw new Errors.SubscriptionAdminDeletionError({})
  }
}

async function _sendDeleteEmail(user, force) {
  const emailOptions = {
    to: user.email,
    action: 'account deleted',
    actionDescribed: 'your Overleaf account was deleted',
  }
  try {
    await EmailHandler.promises.sendEmail('securityAlert', emailOptions)
  } catch (error) {
    if (force) {
      logger.error(
        { error },
        'error sending account deletion email notification'
      )
    } else {
      throw error
    }
  }
}

async function _createDeletedUser(user, options) {
  await DeletedUser.updateOne(
    { 'deleterData.deletedUserId': user._id },
    {
      user,
      deleterData: {
        deletedAt: new Date(),
        deleterId: options.deleterUser ? options.deleterUser._id : undefined,
        deleterIpAddress: options.ipAddress,
        deletedUserId: user._id,
        deletedUserLastLoggedIn: user.lastLoggedIn,
        deletedUserSignUpDate: user.signUpDate,
        deletedUserLoginCount: user.loginCount,
        deletedUserReferralId: user.referal_id,
        deletedUserReferredUsers: user.refered_users,
        deletedUserReferredUserCount: user.refered_user_count,
        deletedUserOverleafId: user.overleaf ? user.overleaf.id : undefined,
      },
    },
    { upsert: true }
  )
}

async function _cleanupUser(user) {
  const userId = user._id

  logger.info({ userId }, '[cleanupUser] removing user sessions from Redis')
  await UserSessionsManager.promises.removeSessionsFromRedis(user)
  logger.info({ userId }, '[cleanupUser] unsubscribing from newsletters')
  await NewsletterManager.promises.unsubscribe(user, { delete: true })
  logger.info({ userId }, '[cleanupUser] cancelling subscription')
  await SubscriptionHandler.promises.cancelSubscription(user)
  logger.info({ userId }, '[cleanupUser] deleting affiliations')
  await InstitutionsAPI.promises.deleteAffiliations(userId)
  logger.info({ userId }, '[cleanupUser] removing user from groups')
  await SubscriptionUpdater.promises.removeUserFromAllGroups(userId)
  logger.info({ userId }, '[cleanupUser] removing user from memberships')
  await UserMembershipsHandler.promises.removeUserFromAllEntities(userId)
  logger.info({ userId }, '[cleanupUser] removing personal access tokens')
  await Modules.promises.hooks.fire('cleanupPersonalAccessTokens', userId, [
    'collabratec',
    'git_bridge',
  ])
}
