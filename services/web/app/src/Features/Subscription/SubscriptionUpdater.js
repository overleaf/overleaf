const { db, ObjectId } = require('../../infrastructure/mongodb')
const { callbackify } = require('@overleaf/promise-utils')
const { Subscription } = require('../../models/Subscription')
const SubscriptionLocator = require('./SubscriptionLocator')
const PlansLocator = require('./PlansLocator')
const FeaturesUpdater = require('./FeaturesUpdater')
const FeaturesHelper = require('./FeaturesHelper')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const { DeletedSubscription } = require('../../models/DeletedSubscription')
const logger = require('@overleaf/logger')
const Features = require('../../infrastructure/Features')
const UserAuditLogHandler = require('../User/UserAuditLogHandler')
const AccountMappingHelper = require('../Analytics/AccountMappingHelper')
const { SSOConfig } = require('../../models/SSOConfig')

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
    _id: new ObjectId(subscription._id),
    customAccount: true,
  }
  const update = {
    $set: { admin_id: new ObjectId(adminId) },
  }
  if (subscription.groupPlan) {
    update.$addToSet = { manager_ids: new ObjectId(adminId) }
  } else {
    update.$set.manager_ids = [new ObjectId(adminId)]
  }
  await Subscription.updateOne(query, update).exec()
}

async function syncSubscription(
  recurlySubscription,
  adminUserId,
  requesterData = {}
) {
  let subscription =
    await SubscriptionLocator.promises.getUsersSubscription(adminUserId)
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
  await UserAuditLogHandler.promises.addEntry(
    userId,
    'join-group-subscription',
    undefined,
    undefined,
    { subscriptionId }
  )
  await Subscription.updateOne(
    { _id: subscriptionId },
    { $addToSet: { member_ids: userId } }
  ).exec()
  await FeaturesUpdater.promises.refreshFeatures(userId, 'add-to-group')
  await _sendUserGroupPlanCodeUserProperty(userId)
  await _sendSubscriptionEvent(
    userId,
    subscriptionId,
    'group-subscription-joined'
  )
}

async function removeUserFromGroup(subscriptionId, userId) {
  await UserAuditLogHandler.promises.addEntry(
    userId,
    'leave-group-subscription',
    undefined,
    undefined,
    { subscriptionId }
  )
  await Subscription.updateOne(
    { _id: subscriptionId },
    { $pull: { member_ids: userId } }
  ).exec()
  await FeaturesUpdater.promises.refreshFeatures(
    userId,
    'remove-user-from-group'
  )
  await _sendUserGroupPlanCodeUserProperty(userId)
  await _sendSubscriptionEvent(
    userId,
    subscriptionId,
    'group-subscription-left'
  )
}

async function removeUserFromAllGroups(userId) {
  const subscriptions =
    await SubscriptionLocator.promises.getMemberSubscriptions(userId)
  if (subscriptions.length === 0) {
    return
  }
  const subscriptionIds = subscriptions.map(sub => sub._id)
  const removeOperation = { $pull: { member_ids: userId } }

  for (const subscriptionId of subscriptionIds) {
    await UserAuditLogHandler.promises.addEntry(
      userId,
      'leave-group-subscription',
      undefined,
      undefined,
      { subscriptionId }
    )
  }

  await Subscription.updateMany(
    { _id: subscriptionIds },
    removeOperation
  ).exec()
  await FeaturesUpdater.promises.refreshFeatures(
    userId,
    'remove-user-from-groups'
  )
  for (const subscriptionId of subscriptionIds) {
    await _sendSubscriptionEvent(
      userId,
      subscriptionId,
      'group-subscription-left'
    )
  }
  await _sendUserGroupPlanCodeUserProperty(userId)
}

async function deleteWithV1Id(v1TeamId) {
  await Subscription.deleteOne({ 'overleaf.id': v1TeamId }).exec()
}

async function deleteSubscription(subscription, deleterData) {
  // 1. create deletedSubscription
  await createDeletedSubscription(subscription, deleterData)

  // 2. notify analytics that members left the subscription
  await _sendSubscriptionEventForAllMembers(
    subscription._id,
    'group-subscription-left'
  )

  // 3. remove subscription
  await Subscription.deleteOne({ _id: subscription._id }).exec()

  // 4. refresh users features
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

  // 4. notify analytics that members rejoined the subscription
  await _sendSubscriptionEventForAllMembers(
    subscriptionId,
    'group-subscription-joined'
  )
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
    subscription,
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
    const hasManagedUsersFeature =
      Features.hasFeature('saas') && subscription?.managedUsersEnabled

    // If a payment lapses and if the group is managed or has group SSO, as a temporary measure we need to
    // make sure that the group continues as-is and no destructive actions are taken.
    if (hasManagedUsersFeature) {
      logger.warn(
        { subscriptionId: subscription._id },
        'expired subscription has managedUsers feature enabled, skipping deletion'
      )
    } else {
      let hasGroupSSOEnabled = false
      if (subscription?.ssoConfig) {
        const ssoConfig = await SSOConfig.findOne({
          _id: subscription.ssoConfig._id || subscription.ssoConfig,
        })
          .lean()
          .exec()
        if (ssoConfig.enabled) {
          hasGroupSSOEnabled = true
        }
      }

      if (hasGroupSSOEnabled) {
        logger.warn(
          { subscriptionId: subscription._id },
          'expired subscription has groupSSO feature enabled, skipping deletion'
        )
      } else {
        await deleteSubscription(subscription, requesterData)
      }
    }
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

  const addOns = recurlySubscription?.subscription_add_ons?.map(addOn => {
    return {
      addOnCode: addOn.add_on_code,
      quantity: addOn.quantity,
      unitAmountInCents: addOn.unit_amount_in_cents,
    }
  })

  subscription.recurlySubscription_id = recurlySubscription.uuid
  subscription.planCode = updatedPlanCode
  subscription.addOns = addOns || []
  subscription.recurlyStatus = {
    state: recurlySubscription.state,
    trialStartedAt: recurlySubscription.trial_started_at,
    trialEndsAt: recurlySubscription.trial_ends_at,
  }

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

  const accountMapping =
    AccountMappingHelper.generateSubscriptionToRecurlyMapping(
      subscription._id,
      subscription.recurlySubscription_id
    )
  if (accountMapping) {
    AnalyticsManager.registerAccountMapping(accountMapping)
  }

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
    AnalyticsManager.setUserPropertyForUserInBackground(
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

async function _sendSubscriptionEvent(userId, subscriptionId, event) {
  const subscription = await Subscription.findOne(
    { _id: subscriptionId },
    { recurlySubscription_id: 1, groupPlan: 1 }
  )
  if (!subscription || !subscription.groupPlan) {
    return
  }
  AnalyticsManager.recordEventForUserInBackground(userId, event, {
    groupId: subscription._id.toString(),
    subscriptionId: subscription.recurlySubscription_id,
  })
}

async function _sendSubscriptionEventForAllMembers(subscriptionId, event) {
  const subscription = await Subscription.findOne(
    { _id: subscriptionId },
    {
      recurlySubscription_id: 1,
      member_ids: 1,
      groupPlan: 1,
    }
  )
  if (!subscription) {
    return
  }
  const userIds = (subscription.member_ids || []).filter(Boolean)
  for (const userId of userIds) {
    if (userId) {
      AnalyticsManager.recordEventForUserInBackground(userId, event, {
        groupId: subscription._id.toString(),
        subscriptionId: subscription.recurlySubscription_id,
      })
    }
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
