import { db, ObjectId } from '../../infrastructure/mongodb.mjs'
import { callbackify } from '@overleaf/promise-utils'
import { Subscription } from '../../models/Subscription.mjs'
import SubscriptionLocator from './SubscriptionLocator.mjs'
import PlansLocator from './PlansLocator.mjs'
import FeaturesUpdater from './FeaturesUpdater.mjs'
import FeaturesHelper from './FeaturesHelper.mjs'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'
import { DeletedSubscription } from '../../models/DeletedSubscription.mjs'
import logger from '@overleaf/logger'
import Features from '../../infrastructure/Features.mjs'
import UserAuditLogHandler from '../User/UserAuditLogHandler.mjs'
import UserUpdater from '../User/UserUpdater.mjs'
import AccountMappingHelper from '../Analytics/AccountMappingHelper.mjs'
import { SSOConfig } from '../../models/SSOConfig.mjs'
import mongoose from '../../infrastructure/Mongoose.mjs'
import Modules from '../../infrastructure/Modules.mjs'

/**
 * @typedef {import('../../../../types/subscription/dashboard/subscription').Subscription} Subscription
 * @typedef {import('../../../../types/subscription/dashboard/subscription').PaymentProvider} PaymentProvider
 * @typedef {import('../../../../types/group-management/group-audit-log').GroupAuditLog} GroupAuditLog
 * @import { AddOn } from '../../../../types/subscription/plan'
 * @typedef {InstanceType<Subscription>} MongoSubscription
 */

/**
 *
 * @param {GroupAuditLog} auditLog
 */
async function subscriptionUpdateWithAuditLog(dbFilter, dbUpdate, auditLog) {
  const session = await mongoose.startSession()

  try {
    await session.withTransaction(async () => {
      await Subscription.updateOne(dbFilter, dbUpdate, { session }).exec()

      await Modules.promises.hooks.fire(
        'addGroupAuditLogEntry',
        auditLog,
        session
      )
    })
  } finally {
    await session.endSession()
  }
}

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
    subscription = await createNewSubscription(adminUserId)
  }
  await updateSubscriptionFromRecurly(
    recurlySubscription,
    subscription,
    requesterData
  )
}

async function addUserToGroup(subscriptionId, userId, auditLog) {
  await UserAuditLogHandler.promises.addEntry(
    userId,
    'join-group-subscription',
    undefined,
    undefined,
    { subscriptionId }
  )

  await subscriptionUpdateWithAuditLog(
    { _id: subscriptionId },
    { $addToSet: { member_ids: userId } },
    {
      initiatorId: auditLog?.initiatorId,
      ipAddress: auditLog?.ipAddress,
      groupId: subscriptionId,
      operation: 'join-group',
    }
  )

  await FeaturesUpdater.promises.refreshFeatures(userId, 'add-to-group')
  await _sendUserGroupPlanCodeUserProperty(userId)
  await _sendSubscriptionEvent(
    userId,
    subscriptionId,
    'group-subscription-joined'
  )
}

async function removeUserFromGroup(subscriptionId, userId, auditLog) {
  await UserAuditLogHandler.promises.addEntry(
    userId,
    'leave-group-subscription',
    undefined,
    undefined,
    { subscriptionId }
  )

  await subscriptionUpdateWithAuditLog(
    { _id: subscriptionId },
    { $pull: { member_ids: userId } },
    {
      initiatorId: auditLog?.initiatorId,
      ipAddress: auditLog?.ipAddress,
      groupId: subscriptionId,
      operation: 'leave-group',
      info: { userIdRemoved: userId },
    }
  )

  await Subscription.updateOne(
    { _id: subscriptionId },
    { $pull: { member_ids: userId } }
  ).exec()

  const subscription = await Subscription.findById(subscriptionId)
  if (subscription.managedUsersEnabled) {
    await UserUpdater.promises.updateUser(
      { _id: userId },
      {
        $unset: {
          'enrollment.managedBy': 1,
          'enrollment.enrolledAt': 1,
        },
      }
    )
  }

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
  await scheduleRefreshFeatures(subscription)
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

/**
 *
 * @param {Subscription} subscription
 */
async function scheduleRefreshFeatures(subscription) {
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

/**
 * Creates a new subscription for the given admin user.
 *
 * @param {string} adminUserId
 * @returns {Promise<Subscription>}
 */
async function createNewSubscription(adminUserId) {
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
  const newSubscription = await createNewSubscription(adminUserId)
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
  if (
    subscription?.paymentProvider?.service &&
    subscription.paymentProvider.service.includes('stripe')
  ) {
    logger.warn(
      { subscriptionId: subscription._id },
      'attempted to update non-recurly subscription from Recurly data'
    )
    return
  }

  if (recurlySubscription.state === 'expired') {
    await handleExpiredSubscription(subscription, requesterData)
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

  await scheduleRefreshFeatures(subscription)
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

async function handleExpiredSubscription(subscription, requesterData) {
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

/**
 * Sets the plan code and addon state to revert the plan to in case of failed upgrades, or clears the last restore point if it was used/ voided
 * @param {ObjectId} subscriptionId the mongo ID of the subscription to set the restore point for
 * @param {string} planCode the plan code to revert to
 * @param {Array<AddOn>} addOns the addOns to revert to
 * @param {Boolean} consumed whether the restore point was used to revert a subscription
 */
async function setRestorePoint(subscriptionId, planCode, addOns, consumed) {
  const update = {
    $set: {
      'lastSuccesfulSubscription.planCode': planCode,
      'lastSuccesfulSubscription.addOns': addOns,
    },
  }

  if (consumed) {
    update.$inc = { timesRevertedDueToFailedPayment: 1 }
  }

  await Subscription.updateOne({ _id: subscriptionId }, update).exec()
}

/**
 * Change the ownershiop of the given subscription.
 * @param {MongoSubscription} subscription
 * @param {string} adminId
 * @param {boolean} clearPreviousPaymentProvider whether to clear the previousPaymentProvider field or set it to the current paymentProvider
 */
async function transferSubscriptionOwnership(
  subscription,
  adminId,
  clearPreviousPaymentProvider
) {
  const query = {
    _id: new ObjectId(subscription._id),
  }

  const update = {
    $set: { admin_id: new ObjectId(adminId) },
  }
  if (subscription.groupPlan) {
    update.$addToSet = { manager_ids: new ObjectId(adminId) }
  } else {
    update.$set.manager_ids = [new ObjectId(adminId)]
  }

  if (clearPreviousPaymentProvider) {
    update.$unset = { previousPaymentProvider: 1 }
  } else {
    update.$set.previousPaymentProvider = subscription.paymentProvider
  }
  await Subscription.updateOne(query, update).exec()
}

/**
 * Clears the restore point for a given subscription, and signals that the subscription was sucessfully reverted.
 *
 * @async
 * @function setSubscriptionWasReverted
 * @param {ObjectId} subscriptionId the mongo ID of the subscription to set the restore point for
 * @returns {Promise<void>} Resolves when the restore point has been cleared.
 */
async function setSubscriptionWasReverted(subscriptionId) {
  // consume the backup and flag that the subscription was reverted due to failed payment
  await setRestorePoint(subscriptionId, null, null, true)
}

/**
 * Clears the restore point for a given subscription, and signals that the subscription was not reverted.
 *
 * @async
 * @function voidRestorePoint
 * @param {string} subscriptionId - The unique identifier of the subscription.
 * @returns {Promise<void>} Resolves when the restore point has been cleared.
 */
async function voidRestorePoint(subscriptionId) {
  await setRestorePoint(subscriptionId, null, null, false)
}

export default {
  updateAdmin: callbackify(updateAdmin),
  syncSubscription: callbackify(syncSubscription),
  createNewSubscription: callbackify(createNewSubscription),
  deleteSubscription: callbackify(deleteSubscription),
  createDeletedSubscription: callbackify(createDeletedSubscription),
  addUserToGroup: callbackify(addUserToGroup),
  refreshUsersFeatures: callbackify(refreshUsersFeatures),
  removeUserFromGroup: callbackify(removeUserFromGroup),
  removeUserFromAllGroups: callbackify(removeUserFromAllGroups),
  deleteWithV1Id: callbackify(deleteWithV1Id),
  restoreSubscription: callbackify(restoreSubscription),
  updateSubscriptionFromRecurly: callbackify(updateSubscriptionFromRecurly),
  scheduleRefreshFeatures: callbackify(scheduleRefreshFeatures),
  setSubscriptionRestorePoint: callbackify(setRestorePoint),
  setSubscriptionWasReverted: callbackify(setSubscriptionWasReverted),
  voidRestorePoint: callbackify(voidRestorePoint),
  promises: {
    updateAdmin,
    syncSubscription,
    createNewSubscription,
    addUserToGroup,
    refreshUsersFeatures,
    removeUserFromGroup,
    removeUserFromAllGroups,
    deleteSubscription,
    createDeletedSubscription,
    deleteWithV1Id,
    restoreSubscription,
    updateSubscriptionFromRecurly,
    scheduleRefreshFeatures,
    setRestorePoint,
    setSubscriptionWasReverted,
    voidRestorePoint,
    handleExpiredSubscription,
    transferSubscriptionOwnership,
  },
}
