const { User } = require('../../models/User')
const { DeletedUser } = require('../../models/DeletedUser')
const NewsletterManager = require('../Newsletter/NewsletterManager')
const ProjectDeleterPromises = require('../Project/ProjectDeleter').promises
const logger = require('logger-sharelatex')
const moment = require('moment')
const SubscriptionHandler = require('../Subscription/SubscriptionHandler')
const SubscriptionUpdater = require('../Subscription/SubscriptionUpdater')
const SubscriptionLocator = require('../Subscription/SubscriptionLocator')
const UserMembershipsHandler = require('../UserMembership/UserMembershipsHandler')
const async = require('async')
const InstitutionsAPI = require('../Institutions/InstitutionsAPI')
const Errors = require('../Errors/Errors')
const { promisify, callbackify } = require('util')

let UserDeleter
module.exports = UserDeleter = {
  deleteUser: callbackify(deleteUser),
  expireDeletedUser: callbackify(expireDeletedUser),
  ensureCanDeleteUser: callbackify(ensureCanDeleteUser),
  expireDeletedUsersAfterDuration: callbackify(expireDeletedUsersAfterDuration),

  promises: {
    deleteUser: deleteUser,
    expireDeletedUser: expireDeletedUser,
    ensureCanDeleteUser: ensureCanDeleteUser,
    expireDeletedUsersAfterDuration: expireDeletedUsersAfterDuration
  }
}

async function deleteUser(userId, options = {}) {
  if (!userId) {
    logger.warn('user_id is null when trying to delete user')
    throw new Error('no user_id')
  }

  try {
    let user = await User.findById(userId).exec()
    logger.log({ user }, 'deleting user')

    await UserDeleter.promises.ensureCanDeleteUser(user)
    await _createDeletedUser(user, options)
    await _cleanupUser(user)
    await ProjectDeleterPromises.deleteUsersProjects(user._id)
    await User.deleteOne({ _id: userId }).exec()
  } catch (error) {
    logger.warn({ error, userId }, 'something went wrong deleting the user')
    throw error
  }
}

async function expireDeletedUser(userId) {
  let deletedUser = await DeletedUser.findOne({
    'deleterData.deletedUserId': userId
  }).exec()

  deletedUser.user = undefined
  deletedUser.deleterData.deleterIpAddress = undefined
  await deletedUser.save()
}

async function expireDeletedUsersAfterDuration() {
  const DURATION = 90
  let deletedUsers = await DeletedUser.find({
    'deleterData.deletedAt': {
      $lt: new Date(moment().subtract(DURATION, 'days'))
    },
    user: {
      $ne: null
    }
  }).exec()

  if (deletedUsers.length === 0) {
    logger.log('No deleted users were found for duration')
    return
  }

  for (let i = 0; i < deletedUsers.length; i++) {
    await UserDeleter.promises.expireDeletedUser(
      deletedUsers[i].deleterData.deletedUserId
    )
  }
}

async function ensureCanDeleteUser(user) {
  await new Promise((resolve, reject) => {
    SubscriptionLocator.getUsersSubscription(user, (error, subscription) => {
      if (error) {
        return reject(error)
      }

      if (subscription) {
        return reject(new Errors.SubscriptionAdminDeletionError({}))
      }

      resolve()
    })
  })
}

async function _createDeletedUser(user, options) {
  await DeletedUser.create({
    user: user,
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
      deletedUserOverleafId: user.overleaf ? user.overleaf.id : undefined
    }
  })
}

async function _cleanupUser(user) {
  if (user == null) {
    throw new Error('no user supplied')
  }

  const runInSeries = promisify(async.series)

  await runInSeries([
    cb =>
      NewsletterManager.unsubscribe(user, err => {
        logger.err('Failed to unsubscribe user from newsletter', {
          user_id: user._id,
          error: err
        })
        cb()
      }),
    cb => SubscriptionHandler.cancelSubscription(user, cb),
    cb => InstitutionsAPI.deleteAffiliations(user._id, cb),
    cb => SubscriptionUpdater.removeUserFromAllGroups(user._id, cb),
    cb => UserMembershipsHandler.removeUserFromAllEntities(user._id, cb)
  ])
}
