const { db, ObjectId } = require('../../infrastructure/mongodb')
const { callbackify } = require('../../util/promises')
const { Subscription } = require('../../models/Subscription')
const SubscriptionLocator = require('./SubscriptionLocator')
const PlansLocator = require('./PlansLocator')
const FeaturesUpdater = require('./FeaturesUpdater')
const FeaturesHelper = require('./FeaturesHelper')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const { DeletedSubscription } = require('../../models/DeletedSubscription')
const logger = require('@overleaf/logger')

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
async function updateAdmin(subscription, adminId) {
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
  await Subscription.updateOne(query, update).exec()
}

async function syncSubscription(
  recurlySubscription,
  adminUserId,
  requesterData = {}
) {
  let subscription = await SubscriptionLocator.promises.getUsersSubscription(
    adminUserId
  )
  if (subscription == null) {
    subscription = await _createNewSubscription(adminUserId)
  }
  await updateSubscriptionFromRecurly(
    recurlySubscription,
    subscription,
    requesterData
  )
}

async function addUserToGroup(subscriptionId, userId) {
  await Subscription.updateOne(
    { _id: subscriptionId },
    { $addToSet: { member_ids: userId } }
  ).exec()
  await FeaturesUpdater.promises.refreshFeatures(userId, 'add-to-group')
  await _sendUserGroupPlanCodeUserProperty(userId)
}

async function removeUserFromGroup(subscriptionId, userId) {
  await Subscription.updateOne(
    { _id: subscriptionId },
    { $pull: { member_ids: userId } }
  ).exec()
  await FeaturesUpdater.promises.refreshFeatures(
    userId,
    'remove-user-from-group'
  )
  await _sendUserGroupPlanCodeUserProperty(userId)
}

async function removeUserFromAllGroups(userId) {
  const subscriptions =
    await SubscriptionLocator.promises.getMemberSubscriptions(userId)
  if (subscriptions.length === 0) {
    return
  }
  const subscriptionIds = subscriptions.map(sub => sub._id)
  const removeOperation = { $pull: { member_ids: userId } }
  await Subscription.updateMany(
    { _id: subscriptionIds },
    removeOperation
  ).exec()
  await FeaturesUpdater.promises.refreshFeatures(
    userId,
    'remove-user-from-groups'
  )
  await _sendUserGroupPlanCodeUserProperty(userId)
}

async function deleteWithV1Id(v1TeamId) {
  await Subscription.deleteOne({ 'overleaf.id': v1TeamId }).exec()
}

async function deleteSubscription(subscription, deleterData) {
  // 1. create deletedSubscription
  await createDeletedSubscription(subscription, deleterData)

  // 2. remove subscription
  await Subscription.deleteOne({ _id: subscription._id }).exec()

  // 3. refresh users features
  await _scheduleRefreshFeatures(subscription)
}

async function restoreSubscription(subscriptionId) {
  const deletedSubscription =
    await SubscriptionLocator.promises.getDeletedSubscription(subscriptionId)
  const subscription = deletedSubscription.subscription

  // 1. upsert subscription
  await db.subscriptions.updateOne(
    { _id: subscription._id },
    { $set: subscription },
    { upsert: true }
  )

  // 2. refresh users features. Do this before removing the
  //    subscription so the restore can be retried if this fails
  await refreshUsersFeatures(subscription)

  // 3. remove deleted subscription
  await DeletedSubscription.deleteOne({
    'subscription._id': subscription._id,
  }).exec()
}

async function refreshUsersFeatures(subscription) {
  const userIds = [subscription.admin_id].concat(subscription.member_ids || [])
  for (const userId of userIds) {
    await FeaturesUpdater.promises.refreshFeatures(
      userId,
      'subscription-updater'
    )
  }
}

async function _scheduleRefreshFeatures(subscription) {
  const userIds = [subscription.admin_id].concat(subscription.member_ids || [])
  for (const userId of userIds) {
    await FeaturesUpdater.promises.scheduleRefreshFeatures(
      userId,
      'subscription-updater'
    )
  }
}

async function createDeletedSubscription(subscription, deleterData) {
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
  await DeletedSubscription.findOneAndUpdate(filter, data, options).exec()
}

async function _createNewSubscription(adminUserId) {
  const subscription = new Subscription({
    admin_id: adminUserId,
    manager_ids: [adminUserId],
  })
  await subscription.save()
  return subscription
}

async function _deleteAndReplaceSubscriptionFromRecurly(
  recurlySubscription,
  subscription,
  requesterData
) {
  const adminUserId = subscription.admin_id
  await deleteSubscription(subscription, requesterData)
  const newSubscription = await _createNewSubscription(adminUserId)
  await updateSubscriptionFromRecurly(
    recurlySubscription,
    newSubscription,
    requesterData
  )
}

async function updateSubscriptionFromRecurly(
  recurlySubscription,
  subscription,
  requesterData
) {
  if (recurlySubscription.state === 'expired') {
    await deleteSubscription(subscription, requesterData)
    return
  }
  const updatedPlanCode = recurlySubscription.plan.plan_code
  const plan = PlansLocator.findLocalPlanInSettings(updatedPlanCode)

  if (plan == null) {
    throw new Error(`plan code not found: ${updatedPlanCode}`)
  }
  if (!plan.groupPlan && subscription.groupPlan) {
    // If downgrading from group to individual plan, delete group sub and create a new one
    await _deleteAndReplaceSubscriptionFromRecurly(
      recurlySubscription,
      subscription,
      requesterData
    )
    return
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
  await subscription.save()
  await _scheduleRefreshFeatures(subscription)
}

async function _sendUserGroupPlanCodeUserProperty(userId) {
  try {
    const subscriptions =
      await SubscriptionLocator.promises.getMemberSubscriptions(userId)
    let bestPlanCode = null
    let bestFeatures = {}
    for (const subscription of subscriptions) {
      const plan = PlansLocator.findLocalPlanInSettings(subscription.planCode)
      if (
        plan &&
        FeaturesHelper.isFeatureSetBetter(plan.features, bestFeatures)
      ) {
        bestPlanCode = plan.planCode
        bestFeatures = plan.features
      }
    }
    AnalyticsManager.setUserPropertyForUser(
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
  updateAdmin: callbackify(updateAdmin),
  syncSubscription: callbackify(syncSubscription),
  deleteSubscription: callbackify(deleteSubscription),
  createDeletedSubscription: callbackify(createDeletedSubscription),
  addUserToGroup: callbackify(addUserToGroup),
  refreshUsersFeatures: callbackify(refreshUsersFeatures),
  removeUserFromGroup: callbackify(removeUserFromGroup),
  removeUserFromAllGroups: callbackify(removeUserFromAllGroups),
  deleteWithV1Id: callbackify(deleteWithV1Id),
  restoreSubscription: callbackify(restoreSubscription),
  updateSubscriptionFromRecurly: callbackify(updateSubscriptionFromRecurly),
  promises: {
    updateAdmin,
    syncSubscription,
    addUserToGroup,
    refreshUsersFeatures,
    removeUserFromGroup,
    removeUserFromAllGroups,
    deleteSubscription,
    createDeletedSubscription,
    deleteWithV1Id,
    restoreSubscription,
    updateSubscriptionFromRecurly,
  },
}
