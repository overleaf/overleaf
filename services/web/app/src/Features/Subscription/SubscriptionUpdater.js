/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let SubscriptionUpdater
const async = require('async')
const _ = require('underscore')
const { Subscription } = require('../../models/Subscription')
const SubscriptionLocator = require('./SubscriptionLocator')
const UserGetter = require('../User/UserGetter')
const PlansLocator = require('./PlansLocator')
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const { ObjectId } = require('mongoose').Types
const FeaturesUpdater = require('./FeaturesUpdater')

const oneMonthInSeconds = 60 * 60 * 24 * 30

module.exports = SubscriptionUpdater = {
  syncSubscription(recurlySubscription, adminUser_id, callback) {
    logger.log(
      { adminUser_id, recurlySubscription },
      'syncSubscription, creating new if subscription does not exist'
    )
    return SubscriptionLocator.getUsersSubscription(adminUser_id, function(
      err,
      subscription
    ) {
      if (err != null) {
        return callback(err)
      }
      if (subscription != null) {
        logger.log(
          { adminUser_id, recurlySubscription },
          'subscription does exist'
        )
        return SubscriptionUpdater._updateSubscriptionFromRecurly(
          recurlySubscription,
          subscription,
          callback
        )
      } else {
        logger.log(
          { adminUser_id, recurlySubscription },
          'subscription does not exist, creating a new one'
        )
        return SubscriptionUpdater._createNewSubscription(
          adminUser_id,
          function(err, subscription) {
            if (err != null) {
              return callback(err)
            }
            return SubscriptionUpdater._updateSubscriptionFromRecurly(
              recurlySubscription,
              subscription,
              callback
            )
          }
        )
      }
    })
  },

  addUserToGroup(subscriptionId, userId, callback) {
    return this.addUsersToGroup(subscriptionId, [userId], callback)
  },

  addUsersToGroup(subscriptionId, memberIds, callback) {
    return this.addUsersToGroupWithoutFeaturesRefresh(
      subscriptionId,
      memberIds,
      function(err) {
        if (err != null) {
          return callback(err)
        }

        // Only apply features updates to users, not user stubs
        return UserGetter.getUsers(memberIds, { _id: 1 }, function(err, users) {
          if (err != null) {
            return callback(err)
          }

          const userIds = users.map(u => u._id.toString())
          return async.map(userIds, FeaturesUpdater.refreshFeatures, callback)
        })
      }
    )
  },

  addUsersToGroupWithoutFeaturesRefresh(subscriptionId, memberIds, callback) {
    logger.log(
      { subscriptionId, memberIds },
      'adding members into mongo subscription'
    )
    const searchOps = { _id: subscriptionId }
    const insertOperation = { $addToSet: { member_ids: { $each: memberIds } } }

    return Subscription.findAndModify(searchOps, insertOperation, callback)
  },

  removeUserFromGroups(filter, user_id, callback) {
    const removeOperation = { $pull: { member_ids: user_id } }
    return Subscription.updateMany(filter, removeOperation, function(err) {
      if (err != null) {
        logger.err(
          { err, searchOps, removeOperation },
          'error removing user from groups'
        )
        return callback(err)
      }
      return UserGetter.getUserOrUserStubById(user_id, {}, function(
        error,
        user,
        isStub
      ) {
        if (error) {
          return callback(error)
        }
        if (isStub) {
          return callback()
        }
        return FeaturesUpdater.refreshFeatures(user_id, callback)
      })
    })
  },

  removeUserFromGroup(subscriptionId, user_id, callback) {
    return SubscriptionUpdater.removeUserFromGroups(
      { _id: subscriptionId },
      user_id,
      callback
    )
  },

  removeUserFromAllGroups(user_id, callback) {
    return SubscriptionLocator.getMemberSubscriptions(user_id, function(
      error,
      subscriptions
    ) {
      if (error) {
        return callback(error)
      }
      if (!subscriptions) {
        return callback()
      }
      const subscriptionIds = subscriptions.map(sub => sub._id)
      return SubscriptionUpdater.removeUserFromGroups(
        { _id: subscriptionIds },
        user_id,
        callback
      )
    })
  },

  deleteWithV1Id(v1TeamId, callback) {
    return Subscription.deleteOne({ 'overleaf.id': v1TeamId }, callback)
  },

  deleteSubscription(subscription_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return SubscriptionLocator.getSubscription(subscription_id, function(
      err,
      subscription
    ) {
      if (err != null) {
        return callback(err)
      }
      const affected_user_ids = [subscription.admin_id].concat(
        subscription.member_ids || []
      )
      logger.log(
        { subscription_id, affected_user_ids },
        'deleting subscription and downgrading users'
      )
      return Subscription.remove({ _id: ObjectId(subscription_id) }, function(
        err
      ) {
        if (err != null) {
          return callback(err)
        }
        return async.mapSeries(
          affected_user_ids,
          FeaturesUpdater.refreshFeatures,
          callback
        )
      })
    })
  },

  _createNewSubscription(adminUser_id, callback) {
    logger.log({ adminUser_id }, 'creating new subscription')
    const subscription = new Subscription({
      admin_id: adminUser_id,
      manager_ids: [adminUser_id]
    })
    return subscription.save(err => callback(err, subscription))
  },

  _updateSubscriptionFromRecurly(recurlySubscription, subscription, callback) {
    logger.log({ recurlySubscription, subscription }, 'updaing subscription')
    if (recurlySubscription.state === 'expired') {
      return SubscriptionUpdater.deleteSubscription(subscription._id, callback)
    }
    subscription.recurlySubscription_id = recurlySubscription.uuid
    subscription.planCode = recurlySubscription.plan.plan_code
    const plan = PlansLocator.findLocalPlanInSettings(subscription.planCode)
    if (plan == null) {
      return callback(
        new Error(`plan code not found: ${subscription.planCode}`)
      )
    }
    if (plan.groupPlan) {
      subscription.groupPlan = true
      subscription.membersLimit = plan.membersLimit
    }
    return subscription.save(function() {
      const allIds = _.union(subscription.member_ids, [subscription.admin_id])
      const jobs = allIds.map(user_id => cb =>
        FeaturesUpdater.refreshFeatures(user_id, cb)
      )
      return async.series(jobs, callback)
    })
  }
}
