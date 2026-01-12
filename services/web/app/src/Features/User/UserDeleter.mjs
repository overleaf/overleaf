import { callbackify } from 'node:util'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import { User } from '../../models/User.mjs'
import { DeletedUser } from '../../models/DeletedUser.mjs'
import { UserAuditLogEntry } from '../../models/UserAuditLogEntry.mjs'
import NewsletterManager from '../Newsletter/NewsletterManager.mjs'
import ProjectDeleter from '../Project/ProjectDeleter.mjs'
import SubscriptionHandler from '../Subscription/SubscriptionHandler.mjs'
import SubscriptionUpdater from '../Subscription/SubscriptionUpdater.mjs'
import SubscriptionLocator from '../Subscription/SubscriptionLocator.mjs'
import UserMembershipsHandler from '../UserMembership/UserMembershipsHandler.mjs'
import UserSessionsManager from './UserSessionsManager.mjs'
import UserAuditLogHandler from './UserAuditLogHandler.mjs'
import InstitutionsAPI from '../Institutions/InstitutionsAPI.mjs'
import Modules from '../../infrastructure/Modules.mjs'
import Errors from '../Errors/Errors.js'
import OnboardingDataCollectionManager from '../OnboardingDataCollection/OnboardingDataCollectionManager.mjs'
import EmailHandler from '../Email/EmailHandler.mjs'
import Features from '../../infrastructure/Features.mjs'

export default {
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

    // add audit log entry before _cleanUpUser removes any group subscriptions
    logger.info({ userId }, 'adding delete-account audit log entry')
    await UserAuditLogHandler.promises.addEntry(
      userId,
      'delete-account',
      options.deleterUser ? options.deleterUser._id : userId,
      options.ipAddress,
      {}
    )

    logger.info({ userId }, 'cleaning up user')
    await _cleanupUser(user)
    logger.info({ userId }, 'firing deleteUser hook')
    await Modules.promises.hooks.fire('deleteUser', userId)

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
  logger.info({ userId }, 'expiring deleted user')
  try {
    logger.info({ userId }, 'firing expireDeletedUser hook')
    await Modules.promises.hooks.fire('expireDeletedUser', userId)
    logger.info({ userId }, 'removing deleted user onboarding data')
    await OnboardingDataCollectionManager.deleteOnboardingDataCollection(userId)
    logger.info({ userId }, 'redacting PII from the deleted user record')
    const deletedUser = await DeletedUser.findOne({
      'deleterData.deletedUserId': userId,
    }).exec()
    deletedUser.user = undefined
    deletedUser.deleterData.deleterIpAddress = undefined
    await deletedUser.save()
    logger.info({ userId }, 'deleted user expiry complete')
  } catch (error) {
    logger.warn(
      { error, userId },
      'something went wrong expiring the deleted user'
    )
    throw error
  }
}

async function expireDeletedUsersAfterDuration() {
  const deletedUsers = await DeletedUser.find({
    'deleterData.deletedAt': {
      $lt: new Date(Date.now() - Settings.userHardDeletionDelay),
    },
    user: { $type: 'object' },
  }).exec()

  if (deletedUsers.length === 0) {
    return
  }
  logger.info(
    {
      deletedUsers: deletedUsers.length,
      retentionPeriodInDays:
        Settings.userHardDeletionDelay / (1000 * 60 * 60 * 24),
    },
    'expiring batch of deleted users older than retention period'
  )
  try {
    for (let i = 0; i < deletedUsers.length; i++) {
      const deletedUserId = deletedUsers[i].deleterData.deletedUserId
      await expireDeletedUser(deletedUserId)
      logger.info({ deletedUserId }, 'removing deleted user audit log entries')
      await UserAuditLogEntry.deleteMany({ userId: deletedUserId }).exec()
    }
    logger.info(
      { deletedUsers: deletedUsers.length },
      'batch of deleted users expired successfully'
    )
  } catch (error) {
    logger.warn(
      { error },
      'something went wrong expiring batch of deleted users'
    )
    throw error
  }
}

async function ensureCanDeleteUser(user) {
  if (!Features.hasFeature('saas')) return
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
  if (Features.hasFeature('saas')) {
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
  }
  logger.info({ userId }, '[cleanupUser] removing personal access tokens')
  await Modules.promises.hooks.fire('cleanupPersonalAccessTokens', userId, [
    'collabratec',
    'git_bridge',
  ])
}
