const { db } = require('../../infrastructure/mongojs')
const async = require('async')
const { promisifyAll } = require('../../util/promises')
const { Subscription } = require('../../models/Subscription')
const SubscriptionLocator = require('./SubscriptionLocator')
const UserGetter = require('../User/UserGetter')
const PlansLocator = require('./PlansLocator')
const logger = require('logger-sharelatex')
const { ObjectId } = require('mongoose').Types
const FeaturesUpdater = require('./FeaturesUpdater')
const { DeletedSubscription } = require('../../models/DeletedSubscription')

const SubscriptionUpdater = {
  /**
   * Change the admin of the given subscription
   *
   * Validation checks are assumed to have been made:
   *   * subscription exists
   *   * user exists
   *   * user does not have another subscription
   *   * subscription is not a Recurly subscription
   *
   * If the subscription is Recurly, we silently do nothing.
   */
  updateAdmin(subscriptionId, adminId, callback) {
    const query = {
      _id: ObjectId(subscriptionId),
      customAccount: true
    }
    const update = {
      $set: { admin_id: ObjectId(adminId) },
      $addToSet: { manager_ids: ObjectId(adminId) }
    }
    Subscription.update(query, update, callback)
  },

  syncSubscription(recurlySubscription, adminUserId, requesterData, callback) {
    if (!callback) {
      callback = requesterData
      requesterData = {}
    }
    logger.log(
      { adminUserId, recurlySubscription },
      'syncSubscription, creating new if subscription does not exist'
    )
    SubscriptionLocator.getUsersSubscription(adminUserId, function(
      err,
      subscription
    ) {
      if (err != null) {
        return callback(err)
      }
      if (subscription != null) {
        logger.log(
          { adminUserId, recurlySubscription },
          'subscription does exist'
        )
        SubscriptionUpdater._updateSubscriptionFromRecurly(
          recurlySubscription,
          subscription,
          requesterData,
          callback
        )
      } else {
        logger.log(
          { adminUserId, recurlySubscription },
          'subscription does not exist, creating a new one'
        )
        SubscriptionUpdater._createNewSubscription(adminUserId, function(
          err,
          subscription
        ) {
          if (err != null) {
            return callback(err)
          }
          SubscriptionUpdater._updateSubscriptionFromRecurly(
            recurlySubscription,
            subscription,
            requesterData,
            callback
          )
        })
      }
    })
  },

  addUserToGroup(subscriptionId, userId, callback) {
    SubscriptionUpdater.addUsersToGroup(subscriptionId, [userId], callback)
  },

  addUsersToGroup(subscriptionId, memberIds, callback) {
    SubscriptionUpdater.addUsersToGroupWithoutFeaturesRefresh(
      subscriptionId,
      memberIds,
      function(err) {
        if (err != null) {
          return callback(err)
        }

        // Only apply features updates to users, not user stubs
        UserGetter.getUsers(memberIds, { _id: 1 }, function(err, users) {
          if (err != null) {
            return callback(err)
          }

          const userIds = users.map(u => u._id.toString())
          async.map(userIds, FeaturesUpdater.refreshFeatures, callback)
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

    Subscription.findAndModify(searchOps, insertOperation, callback)
  },

  removeUserFromGroups(filter, userId, callback) {
    const removeOperation = { $pull: { member_ids: userId } }
    Subscription.updateMany(filter, removeOperation, function(err) {
      if (err != null) {
        logger.warn(
          { err, filter, removeOperation },
          'error removing user from groups'
        )
        return callback(err)
      }
      UserGetter.getUserOrUserStubById(userId, {}, function(
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
        FeaturesUpdater.refreshFeatures(userId, callback)
      })
    })
  },

  removeUserFromGroup(subscriptionId, userId, callback) {
    SubscriptionUpdater.removeUserFromGroups(
      { _id: subscriptionId },
      userId,
      callback
    )
  },

  removeUserFromAllGroups(userId, callback) {
    SubscriptionLocator.getMemberSubscriptions(userId, function(
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
      SubscriptionUpdater.removeUserFromGroups(
        { _id: subscriptionIds },
        userId,
        callback
      )
    })
  },

  deleteWithV1Id(v1TeamId, callback) {
    Subscription.deleteOne({ 'overleaf.id': v1TeamId }, callback)
  },

  deleteSubscription(subscription, deleterData, callback) {
    if (callback == null) {
      callback = function() {}
    }
    logger.log(
      { subscriptionId: subscription._id },
      'deleting subscription and downgrading users'
    )
    async.series(
      [
        cb =>
          // 1. create deletedSubscription
          SubscriptionUpdater._createDeletedSubscription(
            subscription,
            deleterData,
            cb
          ),
        cb =>
          // 2. remove subscription
          Subscription.remove({ _id: subscription._id }, cb),
        cb =>
          // 3. refresh users features
          SubscriptionUpdater._refreshUsersFeatures(subscription, cb)
      ],
      callback
    )
  },

  restoreSubscription(subscriptionId, callback) {
    SubscriptionLocator.getDeletedSubscription(subscriptionId, function(
      err,
      deletedSubscription
    ) {
      if (err) {
        return callback(err)
      }
      let subscription = deletedSubscription.subscription
      async.series(
        [
          cb =>
            // 1. upsert subscription
            db.subscriptions.update(
              { _id: subscription._id },
              subscription,
              { upsert: true },
              cb
            ),
          cb =>
            // 2. refresh users features. Do this before removing the
            //    subscription so the restore can be retried if this fails
            SubscriptionUpdater._refreshUsersFeatures(subscription, cb),
          cb =>
            // 3. remove deleted subscription
            DeletedSubscription.deleteOne(
              { 'subscription._id': subscription._id },
              callback
            )
        ],
        callback
      )
    })
  },

  _refreshUsersFeatures(subscription, callback) {
    const userIds = [subscription.admin_id].concat(
      subscription.member_ids || []
    )
    async.mapSeries(userIds, FeaturesUpdater.refreshFeatures, callback)
  },

  _createDeletedSubscription(subscription, deleterData, callback) {
    subscription.teamInvites = []
    subscription.invited_emails = []
    const filter = { 'subscription._id': subscription._id }
    const data = {
      deleterData: {
        deleterId: deleterData.id,
        deleterIpAddress: deleterData.ip
      },
      subscription: subscription
    }
    const options = { upsert: true, new: true, setDefaultsOnInsert: true }
    DeletedSubscription.findOneAndUpdate(filter, data, options, callback)
  },

  _createNewSubscription(adminUserId, callback) {
    logger.log({ adminUserId }, 'creating new subscription')
    const subscription = new Subscription({
      admin_id: adminUserId,
      manager_ids: [adminUserId]
    })
    subscription.save(err => callback(err, subscription))
  },

  _updateSubscriptionFromRecurly(
    recurlySubscription,
    subscription,
    requesterData,
    callback
  ) {
    logger.log({ recurlySubscription, subscription }, 'updaing subscription')
    if (recurlySubscription.state === 'expired') {
      return SubscriptionUpdater.deleteSubscription(
        subscription,
        requesterData,
        callback
      )
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
    subscription.save(function(error) {
      if (error) {
        return callback(error)
      }
      SubscriptionUpdater._refreshUsersFeatures(subscription, callback)
    })
  }
}

SubscriptionUpdater.promises = promisifyAll(SubscriptionUpdater)
module.exports = SubscriptionUpdater
