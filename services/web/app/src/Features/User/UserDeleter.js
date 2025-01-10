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
    logger.debug({ user }, 'deleting user')

    await ensureCanDeleteUser(user)
    await _cleanupUser(user)
    await Modules.promises.hooks.fire('deleteUser', userId)
    await UserAuditLogHandler.promises.addEntry(
      userId,
      'delete-account',
      options.deleterUser ? options.deleterUser._id : userId,
      options.ipAddress
    )
    await _createDeletedUser(user, options)
    await ProjectDeleter.promises.deleteUsersProjects(user._id)
    await _sendDeleteEmail(user, options.force)
    await deleteMongoUser(user._id)
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
    user: {
      $ne: null,
    },
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
  await UserSessionsManager.promises.removeSessionsFromRedis(user)
  await NewsletterManager.promises.unsubscribe(user, { delete: true })
  await SubscriptionHandler.promises.cancelSubscription(user)
  await InstitutionsAPI.promises.deleteAffiliations(user._id)
  await SubscriptionUpdater.promises.removeUserFromAllGroups(user._id)
  await UserMembershipsHandler.promises.removeUserFromAllEntities(user._id)
  await Modules.promises.hooks.fire('cleanupPersonalAccessTokens', user._id, [
    'collabratec',
    'git_bridge',
  ])
}
