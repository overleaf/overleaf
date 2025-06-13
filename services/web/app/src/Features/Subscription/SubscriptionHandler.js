// @ts-check

const RecurlyWrapper = require('./RecurlyWrapper')
const RecurlyClient = require('./RecurlyClient')
const { User } = require('../../models/User')
const logger = require('@overleaf/logger')
const SubscriptionHelper = require('./SubscriptionHelper')
const SubscriptionUpdater = require('./SubscriptionUpdater')
const SubscriptionLocator = require('./SubscriptionLocator')
const LimitationsManager = require('./LimitationsManager')
const EmailHandler = require('../Email/EmailHandler')
const { callbackify } = require('@overleaf/promise-utils')
const UserUpdater = require('../User/UserUpdater')
const { IndeterminateInvoiceError } = require('../Errors/Errors')
const Modules = require('../../infrastructure/Modules')

/**
 * @import { PaymentProviderSubscriptionChange } from './PaymentProviderEntities'
 */

async function validateNoSubscriptionInRecurly(userId) {
  let subscriptions =
    await RecurlyWrapper.promises.listAccountActiveSubscriptions(userId)

  if (!subscriptions) {
    subscriptions = []
  }

  if (subscriptions.length > 0) {
    await SubscriptionUpdater.promises.syncSubscription(
      subscriptions[0],
      userId
    )

    return false
  }

  return true
}

async function createSubscription(user, subscriptionDetails, recurlyTokenIds) {
  const valid = await validateNoSubscriptionInRecurly(user._id)

  if (!valid) {
    throw new Error('user already has subscription in recurly')
  }

  const recurlySubscription = await RecurlyWrapper.promises.createSubscription(
    user,
    subscriptionDetails,
    recurlyTokenIds
  )

  if (recurlySubscription.trial_started_at) {
    const trialStartedAt = new Date(recurlySubscription.trial_started_at)
    await UserUpdater.promises.updateUser(
      { _id: user._id, lastTrial: { $not: { $gt: trialStartedAt } } },
      { $set: { lastTrial: trialStartedAt } }
    )
  }

  await SubscriptionUpdater.promises.syncSubscription(
    recurlySubscription,
    user._id
  )
}

/**
 * Preview the effect of changing the subscription plan
 *
 * @param {string} userId
 * @param {string} planCode
 * @return {Promise<PaymentProviderSubscriptionChange>}
 */
async function previewSubscriptionChange(userId, planCode) {
  const change = await Modules.promises.hooks.fire(
    'previewSubscriptionChange',
    userId,
    planCode
  )
  return change[0]
}

/**
 * @param user
 * @param planCode
 */
async function updateSubscription(user, planCode) {
  let hasSubscription = false
  let subscription

  try {
    ;({ hasSubscription, subscription } =
      await LimitationsManager.promises.userHasSubscription(user))
  } catch (err) {
    logger.warn(
      { err, userId: user._id },
      'there was an error checking user v2 subscription'
    )
  }

  if (
    !hasSubscription ||
    subscription == null ||
    SubscriptionHelper.getPaymentProviderSubscriptionId(subscription) == null
  ) {
    return
  }

  await Modules.promises.hooks.fire(
    'updatePaidSubscription',
    subscription,
    planCode,
    user._id
  )
}

/**
 * @param user
 */
async function cancelPendingSubscriptionChange(user) {
  const { hasSubscription, subscription } =
    await LimitationsManager.promises.userHasSubscription(user)

  if (hasSubscription && subscription != null) {
    await Modules.promises.hooks.fire(
      'cancelPendingPaidSubscriptionChange',
      subscription
    )
  }
}

/**
 * @param user
 */
async function cancelSubscription(user) {
  try {
    const { hasSubscription, subscription } =
      await LimitationsManager.promises.userHasSubscription(user)
    if (hasSubscription && subscription != null) {
      await Modules.promises.hooks.fire('cancelPaidSubscription', subscription)
      const emailOpts = {
        to: user.email,
        first_name: user.first_name,
      }
      const ONE_HOUR_IN_MS = 1000 * 60 * 60
      EmailHandler.sendDeferredEmail(
        'canceledSubscription',
        emailOpts,
        ONE_HOUR_IN_MS
      )
    }
  } catch (err) {
    logger.warn(
      { err, userId: user._id },
      'there was an error checking user v2 subscription'
    )
  }
}

/**
 * @param user
 */
async function reactivateSubscription(user) {
  try {
    const { hasSubscription, subscription } =
      await LimitationsManager.promises.userHasSubscription(user)
    if (hasSubscription && subscription != null) {
      await Modules.promises.hooks.fire(
        'reactivatePaidSubscription',
        subscription
      )
      EmailHandler.sendEmail(
        'reactivatedSubscription',
        { to: user.email },
        err => {
          if (err) {
            logger.warn(
              { err },
              'failed to send reactivation confirmation email'
            )
          }
        }
      )
    }
  } catch (err) {
    logger.warn(
      { err, userId: user._id },
      'there was an error checking user v2 subscription'
    )
  }
}

/**
 * @param recurlySubscription
 * @param requesterData
 */
async function syncSubscription(recurlySubscription, requesterData) {
  const storedSubscription = await RecurlyWrapper.promises.getSubscription(
    recurlySubscription.uuid,
    { includeAccount: true }
  )

  const user = await User.findById(storedSubscription.account.account_code, {
    _id: 1,
  }).exec()

  if (!user) {
    throw new Error('no user found')
  }

  await SubscriptionUpdater.promises.syncSubscription(
    storedSubscription,
    user._id,
    requesterData
  )
}

/**
 * attempt to collect past due invoice for customer. Only do that when a) the
 * customer is using Paypal and b) there is only one past due invoice.
 * This is used because Recurly doesn't always attempt collection of paast due
 * invoices after Paypal billing info were updated.
 *
 * @param recurlyAccountCode
 */
async function attemptPaypalInvoiceCollection(recurlyAccountCode) {
  const billingInfo =
    await RecurlyWrapper.promises.getBillingInfo(recurlyAccountCode)

  if (!billingInfo.paypal_billing_agreement_id) {
    // this is not a Paypal user
    return
  }

  const pastDueInvoices =
    await RecurlyWrapper.promises.getAccountPastDueInvoices(recurlyAccountCode)

  if (pastDueInvoices.length !== 1) {
    // no past due invoices, or more than one. Ignore.
    return
  }

  return await RecurlyWrapper.promises.attemptInvoiceCollection(
    pastDueInvoices[0].invoice_number
  )
}

async function extendTrial(subscription, daysToExtend) {
  await Modules.promises.hooks.fire('extendTrial', subscription, daysToExtend)
}

/**
 * Preview the effect of purchasing an add-on
 *
 * @param {string} userId
 * @param {string} addOnCode
 * @return {Promise<PaymentProviderSubscriptionChange>}
 */
async function previewAddonPurchase(userId, addOnCode) {
  const change = await Modules.promises.hooks.fire(
    'previewAddOnPurchase',
    userId,
    addOnCode
  )
  return change[0]
}

/**
 * Purchase an add-on for a user
 *
 * @param {string} userId
 * @param {string} addOnCode
 * @param {number} quantity
 */
async function purchaseAddon(userId, addOnCode, quantity) {
  await Modules.promises.hooks.fire(
    'purchaseAddOn',
    userId,
    addOnCode,
    quantity
  )
}

/**
 * Cancels and add-on for a user
 *
 * @param {string} userId
 * @param {string} addOnCode
 */
async function removeAddon(userId, addOnCode) {
  await Modules.promises.hooks.fire('removeAddOn', userId, addOnCode)
}

async function pauseSubscription(user, pauseCycles) {
  // only allow pausing on monthly plans not in a trial
  const { subscription } =
    await LimitationsManager.promises.userHasSubscription(user)
  if (
    !subscription ||
    !SubscriptionHelper.getPaidSubscriptionState(subscription)
  ) {
    throw new Error('No active subscription to pause')
  }

  if (
    !subscription.planCode ||
    subscription.planCode.includes('ann') ||
    subscription.groupPlan
  ) {
    throw new Error('Can only pause monthly individual plans')
  }
  const trialEndsAt =
    SubscriptionHelper.getSubscriptionTrialEndsAt(subscription)
  if (trialEndsAt && trialEndsAt > new Date()) {
    throw new Error('Cannot pause a subscription in a trial')
  }
  if (subscription.addOns?.length) {
    throw new Error('Cannot pause a subscription with addons')
  }

  await RecurlyClient.promises.pauseSubscriptionByUuid(
    subscription.recurlySubscription_id,
    pauseCycles
  )
}

async function resumeSubscription(user) {
  const { subscription } =
    await LimitationsManager.promises.userHasSubscription(user)
  if (
    !subscription ||
    !SubscriptionHelper.getPaidSubscriptionState(subscription)
  ) {
    throw new Error('No active subscription to resume')
  }
  await RecurlyClient.promises.resumeSubscriptionByUuid(
    subscription.recurlySubscription_id
  )
}

/**
 * @param recurlySubscriptionId
 */
async function getSubscriptionRestorePoint(recurlySubscriptionId) {
  const lastSubscription =
    await SubscriptionLocator.promises.getLastSuccessfulSubscription(
      recurlySubscriptionId
    )
  return lastSubscription
}

/**
 * @param recurlySubscriptionId
 * @param subscriptionRestorePoint
 */
async function revertPlanChange(
  recurlySubscriptionId,
  subscriptionRestorePoint
) {
  const subscription = await RecurlyClient.promises.getSubscription(
    recurlySubscriptionId
  )

  const changeRequest = subscription.getRequestForPlanRevert(
    subscriptionRestorePoint.planCode,
    subscriptionRestorePoint.addOns
  )

  const pastDue = await RecurlyClient.promises.getPastDueInvoices(
    recurlySubscriptionId
  )

  // only process revert requests within the past 24 hours, as we dont want to restore plans at the end of their dunning cycle
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (
    pastDue.length !== 1 ||
    !pastDue[0].id ||
    !pastDue[0].dueAt ||
    pastDue[0].dueAt < yesterday ||
    pastDue[0].collectionMethod !== 'automatic'
  ) {
    throw new IndeterminateInvoiceError(
      'cant determine invoice to fail for plan revert',
      {
        recurlySubscriptionId,
      }
    )
  }

  await RecurlyClient.promises.failInvoice(pastDue[0].id)
  await SubscriptionUpdater.promises.setSubscriptionWasReverted(
    subscriptionRestorePoint._id
  )
  await RecurlyClient.promises.applySubscriptionChangeRequest(changeRequest)
  await syncSubscription({ uuid: recurlySubscriptionId }, {})
}

async function setSubscriptionRestorePoint(userId) {
  const subscription =
    await SubscriptionLocator.promises.getUsersSubscription(userId)
  // if the subscription is not a recurly one, we can return early as we dont allow for failed payments on other payment providers
  //  we need to deal with it for recurly, because we cant verify payment in advance
  if (!subscription?.recurlySubscription_id || !subscription.planCode) {
    return
  }
  await SubscriptionUpdater.promises.setRestorePoint(
    subscription.id,
    subscription.planCode,
    subscription.addOns,
    false
  )
}

module.exports = {
  validateNoSubscriptionInRecurly: callbackify(validateNoSubscriptionInRecurly),
  createSubscription: callbackify(createSubscription),
  previewSubscriptionChange: callbackify(previewSubscriptionChange),
  updateSubscription: callbackify(updateSubscription),
  cancelPendingSubscriptionChange: callbackify(cancelPendingSubscriptionChange),
  cancelSubscription: callbackify(cancelSubscription),
  reactivateSubscription: callbackify(reactivateSubscription),
  syncSubscription: callbackify(syncSubscription),
  attemptPaypalInvoiceCollection: callbackify(attemptPaypalInvoiceCollection),
  extendTrial: callbackify(extendTrial),
  previewAddonPurchase: callbackify(previewAddonPurchase),
  purchaseAddon: callbackify(purchaseAddon),
  removeAddon: callbackify(removeAddon),
  pauseSubscription: callbackify(pauseSubscription),
  resumeSubscription: callbackify(resumeSubscription),
  revertPlanChange: callbackify(revertPlanChange),
  setSubscriptionRestorePoint: callbackify(setSubscriptionRestorePoint),
  getSubscriptionRestorePoint: callbackify(getSubscriptionRestorePoint),
  promises: {
    validateNoSubscriptionInRecurly,
    createSubscription,
    previewSubscriptionChange,
    updateSubscription,
    cancelPendingSubscriptionChange,
    cancelSubscription,
    reactivateSubscription,
    syncSubscription,
    attemptPaypalInvoiceCollection,
    extendTrial,
    previewAddonPurchase,
    purchaseAddon,
    removeAddon,
    pauseSubscription,
    resumeSubscription,
    revertPlanChange,
    setSubscriptionRestorePoint,
    getSubscriptionRestorePoint,
  },
}
