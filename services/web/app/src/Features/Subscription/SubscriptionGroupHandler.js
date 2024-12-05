const { callbackify } = require('util')
const SubscriptionUpdater = require('./SubscriptionUpdater')
const SubscriptionLocator = require('./SubscriptionLocator')
const SubscriptionController = require('./SubscriptionController')
const { Subscription } = require('../../models/Subscription')
const SessionManager = require('../Authentication/SessionManager')
const RecurlyClient = require('./RecurlyClient')
const PlansLocator = require('./PlansLocator')

async function removeUserFromGroup(subscriptionId, userIdToRemove) {
  await SubscriptionUpdater.promises.removeUserFromGroup(
    subscriptionId,
    userIdToRemove
  )
}

async function replaceUserReferencesInGroups(oldId, newId) {
  await Subscription.updateOne({ admin_id: oldId }, { admin_id: newId }).exec()

  await _replaceInArray(Subscription, 'manager_ids', oldId, newId)
  await _replaceInArray(Subscription, 'member_ids', oldId, newId)
}

async function isUserPartOfGroup(userId, subscriptionId) {
  const subscription =
    await SubscriptionLocator.promises.getSubscriptionByMemberIdAndId(
      userId,
      subscriptionId
    )

  return !!subscription
}

async function getTotalConfirmedUsersInGroup(subscriptionId) {
  const subscription =
    await SubscriptionLocator.promises.getSubscription(subscriptionId)

  return subscription?.member_ids?.length
}

async function _replaceInArray(model, property, oldValue, newValue) {
  // Mongo won't let us pull and addToSet in the same query, so do it in
  // two. Note we need to add first, since the query is based on the old user.
  const query = {}
  query[property] = oldValue

  const setNewValue = {}
  setNewValue[property] = newValue

  const setOldValue = {}
  setOldValue[property] = oldValue

  await model.updateMany(query, { $addToSet: setNewValue })
  await model.updateMany(query, { $pull: setOldValue })
}

async function ensureFlexibleLicensingEnabled(plan) {
  if (!plan?.canUseFlexibleLicensing) {
    throw new Error('The group plan does not support flexible licencing')
  }
}

async function getUsersGroupSubscriptionDetails(req) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const subscription =
    await SubscriptionLocator.promises.getUsersSubscription(userId)

  if (!subscription.groupPlan) {
    throw new Error('User subscription is not a group plan')
  }

  const plan = PlansLocator.findLocalPlanInSettings(subscription.planCode)

  const recurlySubscription = await RecurlyClient.promises.getSubscription(
    subscription.recurlySubscription_id
  )

  return {
    subscription,
    recurlySubscription,
    plan,
  }
}

async function _addSeatsSubscriptionChange(req) {
  const adding = req.body.adding
  const { recurlySubscription, plan } =
    await getUsersGroupSubscriptionDetails(req)
  await ensureFlexibleLicensingEnabled(plan)
  const userId = SessionManager.getLoggedInUserId(req.session)
  const currentAddonQuantity =
    recurlySubscription.addOns.find(
      addOn => addOn.code === plan.membersLimitAddOn
    )?.quantity ?? 0
  // Keeps only the new total quantity of addon
  const nextAddonQuantity = currentAddonQuantity + adding
  const changeRequest = recurlySubscription.getRequestForAddOnUpdate(
    plan.membersLimitAddOn,
    nextAddonQuantity
  )

  return {
    changeRequest,
    userId,
    currentAddonQuantity,
    recurlySubscription,
    plan,
  }
}

async function previewAddSeatsSubscriptionChange(req) {
  const { changeRequest, userId, currentAddonQuantity, plan } =
    await _addSeatsSubscriptionChange(req)
  const paymentMethod = await RecurlyClient.promises.getPaymentMethod(userId)
  const subscriptionChange =
    await RecurlyClient.promises.previewSubscriptionChange(changeRequest)
  const subscriptionChangePreview =
    await SubscriptionController.makeChangePreview(
      {
        type: 'add-on-update',
        addOn: {
          code: plan.membersLimitAddOn,
          quantity: subscriptionChange.nextAddOns.find(
            addon => addon.code === plan.membersLimitAddOn
          ).quantity,
          prevQuantity: currentAddonQuantity,
        },
      },
      subscriptionChange,
      paymentMethod
    )

  return subscriptionChangePreview
}

async function createAddSeatsSubscriptionChange(req) {
  const { changeRequest } = await _addSeatsSubscriptionChange(req)
  await RecurlyClient.promises.applySubscriptionChangeRequest(changeRequest)

  return { adding: req.body.adding }
}

module.exports = {
  removeUserFromGroup: callbackify(removeUserFromGroup),
  replaceUserReferencesInGroups: callbackify(replaceUserReferencesInGroups),
  ensureFlexibleLicensingEnabled: callbackify(ensureFlexibleLicensingEnabled),
  getTotalConfirmedUsersInGroup: callbackify(getTotalConfirmedUsersInGroup),
  isUserPartOfGroup: callbackify(isUserPartOfGroup),
  promises: {
    removeUserFromGroup,
    replaceUserReferencesInGroups,
    ensureFlexibleLicensingEnabled,
    getTotalConfirmedUsersInGroup,
    isUserPartOfGroup,
    getUsersGroupSubscriptionDetails,
    previewAddSeatsSubscriptionChange,
    createAddSeatsSubscriptionChange,
  },
}
