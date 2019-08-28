const { callbackify } = require('util')
const logger = require('logger-sharelatex')
const moment = require('moment')
const { User } = require('../../models/User')
const { DeletedUser } = require('../../models/DeletedUser')
const NewsletterManager = require('../Newsletter/NewsletterManager')
const ProjectDeleter = require('../Project/ProjectDeleter')
const SubscriptionHandler = require('../Subscription/SubscriptionHandler')
const SubscriptionUpdater = require('../Subscription/SubscriptionUpdater')
const SubscriptionLocator = require('../Subscription/SubscriptionLocator')
const UserMembershipsHandler = require('../UserMembership/UserMembershipsHandler')
const InstitutionsAPI = require('../Institutions/InstitutionsAPI')
const Errors = require('../Errors/Errors')

module.exports = {
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

    await ensureCanDeleteUser(user)
    await _cleanupUser(user)
    await _createDeletedUser(user, options)
    await ProjectDeleter.promises.deleteUsersProjects(user._id)
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
    await expireDeletedUser(deletedUsers[i].deleterData.deletedUserId)
  }
}

async function ensureCanDeleteUser(user) {
  const subscription = await SubscriptionLocator.promises.getUsersSubscription(
    user
  )
  if (subscription) {
    throw new Errors.SubscriptionAdminDeletionError({})
  }
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
  await NewsletterManager.promises.unsubscribe(user)
  await SubscriptionHandler.promises.cancelSubscription(user)
  await InstitutionsAPI.promises.deleteAffiliations(user._id)
  await SubscriptionUpdater.promises.removeUserFromAllGroups(user._id)
  await UserMembershipsHandler.promises.removeUserFromAllEntities(user._id)
}
