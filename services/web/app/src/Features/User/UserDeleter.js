/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
    standard/no-callback-literal,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let UserDeleter
const { User } = require('../../models/User')
const NewsletterManager = require('../Newsletter/NewsletterManager')
const ProjectDeleter = require('../Project/ProjectDeleter')
const logger = require('logger-sharelatex')
const SubscriptionHandler = require('../Subscription/SubscriptionHandler')
const SubscriptionUpdater = require('../Subscription/SubscriptionUpdater')
const SubscriptionLocator = require('../Subscription/SubscriptionLocator')
const UserMembershipsHandler = require('../UserMembership/UserMembershipsHandler')
const async = require('async')
const InstitutionsAPI = require('../Institutions/InstitutionsAPI')
const Errors = require('../Errors/Errors')
const { db, ObjectId } = require('../../infrastructure/mongojs')

module.exports = UserDeleter = {
  softDeleteUserForMigration(user_id, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    if (user_id == null) {
      logger.err('user_id is null when trying to delete user')
      return callback(new Error('no user_id'))
    }
    return User.findById(user_id, function(err, user) {
      if (err != null) {
        return callback(err)
      }
      if (user == null) {
        return callback(new Errors.NotFoundError('user not found'))
      }
      return async.series(
        [
          cb => UserDeleter._ensureCanDeleteUser(user, cb),
          cb => UserDeleter._cleanupUser(user, cb),
          cb => ProjectDeleter.deleteUsersProjects(user._id, cb),
          function(cb) {
            user.deletedAt = new Date()
            return db.usersDeletedByMigration.insert(user, cb)
          },
          cb => user.remove(cb)
        ],
        callback
      )
    })
  },

  deleteUser(user_id, callback) {
    if (callback == null) {
      callback = function() {}
    }
    if (user_id == null) {
      logger.err('user_id is null when trying to delete user')
      return callback('no user_id')
    }
    return User.findById(user_id, function(err, user) {
      if (err != null) {
        return callback(err)
      }
      logger.log({ user }, 'deleting user')
      return async.series(
        [
          cb => UserDeleter._ensureCanDeleteUser(user, cb),
          cb => UserDeleter._cleanupUser(user, cb),
          cb => ProjectDeleter.deleteUsersProjects(user._id, cb),
          cb => user.remove(cb)
        ],
        function(err) {
          if (err != null) {
            logger.err(
              { err, user_id },
              'something went wrong deleteing the user'
            )
          }
          return callback(err)
        }
      )
    })
  },

  _cleanupUser(user, callback) {
    if (user == null) {
      return callback(new Error('no user supplied'))
    }
    return async.series(
      [
        cb =>
          NewsletterManager.unsubscribe(user, function(err) {
            logger.err('Failed to unsubscribe user from newsletter', {
              user_id: user._id,
              error: err
            })
            return cb()
          }),
        cb => SubscriptionHandler.cancelSubscription(user, cb),
        cb => InstitutionsAPI.deleteAffiliations(user._id, cb),
        cb => SubscriptionUpdater.removeUserFromAllGroups(user._id, cb),
        cb => UserMembershipsHandler.removeUserFromAllEntities(user._id, cb)
      ],
      callback
    )
  },

  _ensureCanDeleteUser(user, callback) {
    return SubscriptionLocator.getUsersSubscription(user, function(
      error,
      subscription
    ) {
      if (subscription != null) {
        if (!error) {
          error = new Errors.SubscriptionAdminDeletionError()
        }
      }
      return callback(error)
    })
  }
}
