const { db, ObjectId } = require('../../infrastructure/mongodb')
const OError = require('@overleaf/o-error')
const async = require('async')
const { promisify, callbackify } = require('../../util/promises')
const { Subscription } = require('../../models/Subscription')
const SubscriptionLocator = require('./SubscriptionLocator')
const UserGetter = require('../User/UserGetter')
const PlansLocator = require('./PlansLocator')
const FeaturesUpdater = require('./FeaturesUpdater')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const { DeletedSubscription } = require('../../models/DeletedSubscription')
const logger = require('logger-sharelatex')

/**
 * Change the admin of the given subscription.
 *
 * If the subscription is a group, add the new admin as manager while keeping
 * the old admin. Otherwise, replace the manager.
 *
 * Validation checks are assumed to have been made:
 *   * subscription exists
 *   * user exists
 *   * user does not have another subscription
 *   * subscription is not a Recurly subscription
 *
 * If the subscription is Recurly, we silently do nothing.
 */
function updateAdmin(subscription, adminId, callback) {
  const query = {
    _id: ObjectId(subscription._id),
    customAccount: true,
  }
  const update = {
    $set: { admin_id: ObjectId(adminId) },
  }
  if (subscription.groupPlan) {
    update.$addToSet = { manager_ids: ObjectId(adminId) }
  } else {
    update.$set.manager_ids = [ObjectId(adminId)]
  }
  Subscription.updateOne(query, update, callback)
}

function syncSubscription(
  recurlySubscription,
  adminUserId,
  requesterData,
  callback
) {
  if (!callback) {
    callback = requesterData
    requesterData = {}
  }
  SubscriptionLocator.getUsersSubscription(
    adminUserId,
    function (err, subscription) {
      if (err != null) {
        return callback(err)
      }
      if (subscription != null) {
        updateSubscriptionFromRecurly(
          recurlySubscription,
          subscription,
          requesterData,
          callback
        )
      } else {
        _createNewSubscription(adminUserId, function (err, subscription) {
          if (err != null) {
            return callback(err)
          }
          updateSubscriptionFromRecurly(
            recurlySubscription,
            subscription,
            requesterData,
            callback
          )
        })
      }
    }
  )
}

function addUserToGroup(subscriptionId, userId, callback) {
  Subscription.updateOne(
    { _id: subscriptionId },
    { $addToSet: { member_ids: userId } },
    function (err) {
      if (err != null) {
        return callback(err)
      }
      FeaturesUpdater.refreshFeatures(userId, 'add-to-group', function () {
        callbackify(_sendUserGroupPlanCodeUserProperty)(userId, callback)
      })
    }
  )
}

function removeUserFromGroup(subscriptionId, userId, callback) {
  Subscription.updateOne(
    { _id: subscriptionId },
    { $pull: { member_ids: userId } },
    function (error) {
      if (error) {
        OError.tag(error, 'error removing user from group', {
          subscriptionId,
          userId,
        })
        return callback(error)
      }
      UserGetter.getUser(userId, function (error, user) {
        if (error) {
          return callback(error)
        }
        FeaturesUpdater.refreshFeatures(
          userId,
          'remove-user-from-group',
          function () {
            callbackify(_sendUserGroupPlanCodeUserProperty)(userId, callback)
          }
        )
      })
    }
  )
}

function removeUserFromAllGroups(userId, callback) {
  SubscriptionLocator.getMemberSubscriptions(
    userId,
    function (error, subscriptions) {
      if (error) {
        return callback(error)
      }
      if (!subscriptions) {
        return callback()
      }
      const subscriptionIds = subscriptions.map(sub => sub._id)
      const removeOperation = { $pull: { member_ids: userId } }
      Subscription.updateMany(
        { _id: subscriptionIds },
        removeOperation,
        function (error) {
          if (error) {
            OError.tag(error, 'error removing user from groups', {
              userId,
              subscriptionIds,
            })
            return callback(error)
          }
          UserGetter.getUser(userId, function (error, user) {
            if (error) {
              return callback(error)
            }
            FeaturesUpdater.refreshFeatures(
              userId,
              'remove-user-from-groups',
              function () {
                callbackify(_sendUserGroupPlanCodeUserProperty)(
                  userId,
                  callback
                )
              }
            )
          })
        }
      )
    }
  )
}

function deleteWithV1Id(v1TeamId, callback) {
  Subscription.deleteOne({ 'overleaf.id': v1TeamId }, callback)
}

function deleteSubscription(subscription, deleterData, callback) {
  if (callback == null) {
    callback = function () {}
  }
  async.series(
    [
      cb =>
        // 1. create deletedSubscription
        createDeletedSubscription(subscription, deleterData, cb),
      cb =>
        // 2. remove subscription
        Subscription.deleteOne({ _id: subscription._id }, cb),
      cb =>
        // 3. refresh users features
        refreshUsersFeatures(subscription, cb),
    ],
    callback
  )
}

function restoreSubscription(subscriptionId, callback) {
  SubscriptionLocator.getDeletedSubscription(
    subscriptionId,
    function (err, deletedSubscription) {
      if (err) {
        return callback(err)
      }
      const subscription = deletedSubscription.subscription
      async.series(
        [
          cb =>
            // 1. upsert subscription
            db.subscriptions.updateOne(
              { _id: subscription._id },
              subscription,
              { upsert: true },
              cb
            ),
          cb =>
            // 2. refresh users features. Do this before removing the
            //    subscription so the restore can be retried if this fails
            refreshUsersFeatures(subscription, cb),
          cb =>
            // 3. remove deleted subscription
            DeletedSubscription.deleteOne(
              { 'subscription._id': subscription._id },
              callback
            ),
        ],
        callback
      )
    }
  )
}

function refreshUsersFeatures(subscription, callback) {
  const userIds = [subscription.admin_id].concat(subscription.member_ids || [])
  async.mapSeries(
    userIds,
    function (userId, cb) {
      FeaturesUpdater.refreshFeatures(userId, 'subscription-updater', cb)
    },
    callback
  )
}

function createDeletedSubscription(subscription, deleterData, callback) {
  subscription.teamInvites = []
  subscription.invited_emails = []
  const filter = { 'subscription._id': subscription._id }
  const data = {
    deleterData: {
      deleterId: deleterData.id,
      deleterIpAddress: deleterData.ip,
    },
    subscription: subscription,
  }
  const options = { upsert: true, new: true, setDefaultsOnInsert: true }
  DeletedSubscription.findOneAndUpdate(filter, data, options, callback)
}

function _createNewSubscription(adminUserId, callback) {
  const subscription = new Subscription({
    admin_id: adminUserId,
    manager_ids: [adminUserId],
  })
  subscription.save(err => callback(err, subscription))
}

function _deleteAndReplaceSubscriptionFromRecurly(
  recurlySubscription,
  subscription,
  requesterData,
  callback
) {
  const adminUserId = subscription.admin_id
  deleteSubscription(subscription, requesterData, err => {
    if (err) {
      return callback(err)
    }
    _createNewSubscription(adminUserId, (err, newSubscription) => {
      if (err) {
        return callback(err)
      }
      updateSubscriptionFromRecurly(
        recurlySubscription,
        newSubscription,
        requesterData,
        callback
      )
    })
  })
}

function updateSubscriptionFromRecurly(
  recurlySubscription,
  subscription,
  requesterData,
  callback
) {
  if (recurlySubscription.state === 'expired') {
    return deleteSubscription(subscription, requesterData, callback)
  }
  const updatedPlanCode = recurlySubscription.plan.plan_code
  const plan = PlansLocator.findLocalPlanInSettings(updatedPlanCode)

  if (plan == null) {
    return callback(new Error(`plan code not found: ${updatedPlanCode}`))
  }
  if (!plan.groupPlan && subscription.groupPlan) {
    // If downgrading from group to individual plan, delete group sub and create a new one
    return _deleteAndReplaceSubscriptionFromRecurly(
      recurlySubscription,
      subscription,
      requesterData,
      callback
    )
  }

  subscription.recurlySubscription_id = recurlySubscription.uuid
  subscription.planCode = updatedPlanCode

  if (plan.groupPlan) {
    if (!subscription.groupPlan) {
      subscription.member_ids = subscription.member_ids || []
      subscription.member_ids.push(subscription.admin_id)
    }

    subscription.groupPlan = true
    subscription.membersLimit = plan.membersLimit

    // Some plans allow adding more seats than the base plan provides.
    // This is recorded as a subscription add on.
    if (
      plan.membersLimitAddOn &&
      Array.isArray(recurlySubscription.subscription_add_ons)
    ) {
      recurlySubscription.subscription_add_ons.forEach(addOn => {
        if (addOn.add_on_code === plan.membersLimitAddOn) {
          subscription.membersLimit += addOn.quantity
        }
      })
    }
  }
  subscription.save(function (error) {
    if (error) {
      return callback(error)
    }
    refreshUsersFeatures(subscription, callback)
  })
}

async function _sendUserGroupPlanCodeUserProperty(userId) {
  try {
    const subscriptions =
      (await SubscriptionLocator.promises.getMemberSubscriptions(userId)) || []
    let bestPlanCode = null
    let bestFeatures = {}
    for (const subscription of subscriptions) {
      const plan = PlansLocator.findLocalPlanInSettings(subscription.planCode)
      if (
        plan &&
        FeaturesUpdater.isFeatureSetBetter(plan.features, bestFeatures)
      ) {
        bestPlanCode = plan.planCode
        bestFeatures = plan.features
      }
    }
    AnalyticsManager.setUserProperty(
      userId,
      'group-subscription-plan-code',
      bestPlanCode
    )
  } catch (error) {
    logger.error(
      { err: error },
      `Failed to update group-subscription-plan-code property for user ${userId}`
    )
  }
}

module.exports = {
  updateAdmin,
  syncSubscription,
  deleteSubscription,
  createDeletedSubscription,
  addUserToGroup,
  refreshUsersFeatures,
  removeUserFromGroup,
  removeUserFromAllGroups,
  deleteWithV1Id,
  restoreSubscription,
  updateSubscriptionFromRecurly,
  promises: {
    updateAdmin: promisify(updateAdmin),
    syncSubscription: promisify(syncSubscription),
    addUserToGroup: promisify(addUserToGroup),
    refreshUsersFeatures: promisify(refreshUsersFeatures),
    removeUserFromGroup: promisify(removeUserFromGroup),
    removeUserFromAllGroups: promisify(removeUserFromAllGroups),
    deleteSubscription: promisify(deleteSubscription),
    createDeletedSubscription: promisify(createDeletedSubscription),
    deleteWithV1Id: promisify(deleteWithV1Id),
    restoreSubscription: promisify(restoreSubscription),
    updateSubscriptionFromRecurly: promisify(updateSubscriptionFromRecurly),
  },
}
