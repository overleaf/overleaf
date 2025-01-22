// @ts-check

const recurly = require('recurly')
const RecurlyWrapper = require('./RecurlyWrapper')
const RecurlyClient = require('./RecurlyClient')
const { User } = require('../../models/User')
const logger = require('@overleaf/logger')
const SubscriptionUpdater = require('./SubscriptionUpdater')
const SubscriptionLocator = require('./SubscriptionLocator')
const LimitationsManager = require('./LimitationsManager')
const EmailHandler = require('../Email/EmailHandler')
const { callbackify } = require('@overleaf/promise-utils')
const UserUpdater = require('../User/UserUpdater')
const { NotFoundError } = require('../Errors/Errors')

/**
 * @import { RecurlySubscription, RecurlySubscriptionChange } from './RecurlyEntities'
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
 * @return {Promise<RecurlySubscriptionChange>}
 */
async function previewSubscriptionChange(userId, planCode) {
  const subscription = await getSubscriptionForUser(userId)
  const changeRequest = subscription?.getRequestForPlanChange(planCode)
  const change =
    await RecurlyClient.promises.previewSubscriptionChange(changeRequest)
  return change
}

/**
 * @param user
 * @param planCode
 * @param couponCode
 */
async function updateSubscription(user, planCode, couponCode) {
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
    subscription.recurlySubscription_id == null
  ) {
    return
  }
  const recurlySubscriptionId = subscription.recurlySubscription_id

  if (couponCode) {
    const usersSubscription = await RecurlyWrapper.promises.getSubscription(
      recurlySubscriptionId,
      { includeAccount: true }
    )

    await RecurlyWrapper.promises.redeemCoupon(
      usersSubscription.account.account_code,
      couponCode
    )
  }

  const recurlySubscription = await RecurlyClient.promises.getSubscription(
    recurlySubscriptionId
  )
  const changeRequest = recurlySubscription.getRequestForPlanChange(planCode)
  await RecurlyClient.promises.applySubscriptionChangeRequest(changeRequest)
  await syncSubscription({ uuid: recurlySubscriptionId }, user._id)
}

/**
 * @param user
 */
async function cancelPendingSubscriptionChange(user) {
  const { hasSubscription, subscription } =
    await LimitationsManager.promises.userHasSubscription(user)

  if (hasSubscription && subscription != null) {
    await RecurlyClient.promises.removeSubscriptionChangeByUuid(
      subscription.recurlySubscription_id
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
      await RecurlyClient.promises.cancelSubscriptionByUuid(
        subscription.recurlySubscription_id
      )
      await _updateSubscriptionFromRecurly(subscription)
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
      await RecurlyClient.promises.reactivateSubscriptionByUuid(
        subscription.recurlySubscription_id
      )
      await _updateSubscriptionFromRecurly(subscription)
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

async function extendTrial(subscription, daysToExend) {
  await RecurlyWrapper.promises.extendTrial(
    subscription.recurlySubscription_id,
    daysToExend
  )
}

async function _updateSubscriptionFromRecurly(subscription) {
  const recurlySubscription = await RecurlyWrapper.promises.getSubscription(
    subscription.recurlySubscription_id,
    {}
  )
  await SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
    recurlySubscription,
    subscription
  )
}

/**
 * Preview the effect of purchasing an add-on
 *
 * @param {string} userId
 * @param {string} addOnCode
 * @return {Promise<RecurlySubscriptionChange>}
 */
async function previewAddonPurchase(userId, addOnCode) {
  const subscription = await getSubscriptionForUser(userId)

  try {
    await RecurlyClient.promises.getAddOn(subscription.planCode, addOnCode)
  } catch (err) {
    if (err instanceof recurly.errors.NotFoundError) {
      throw new NotFoundError({
        message: 'Add-on not found',
        info: { addOnCode },
      })
    }
    throw err
  }

  const changeRequest = subscription.getRequestForAddOnPurchase(addOnCode)
  const change =
    await RecurlyClient.promises.previewSubscriptionChange(changeRequest)
  return change
}

/**
 * Purchase an add-on for a user
 *
 * @param {string} userId
 * @param {string} addOnCode
 * @param {number} quantity
 */
async function purchaseAddon(userId, addOnCode, quantity) {
  const subscription = await getSubscriptionForUser(userId)
  try {
    await RecurlyClient.promises.getAddOn(subscription.planCode, addOnCode)
  } catch (err) {
    if (err instanceof recurly.errors.NotFoundError) {
      throw new NotFoundError({
        message: 'Add-on not found',
        info: { addOnCode },
      })
    }
    throw err
  }
  const changeRequest = subscription.getRequestForAddOnPurchase(
    addOnCode,
    quantity
  )
  await RecurlyClient.promises.applySubscriptionChangeRequest(changeRequest)
  await syncSubscription({ uuid: subscription.id }, userId)
}

/**
 * Cancels and add-on for a user
 *
 * @param {string} userId
 * @param {string} addOnCode
 */
async function removeAddon(userId, addOnCode) {
  const subscription = await getSubscriptionForUser(userId)
  const changeRequest = subscription.getRequestForAddOnRemoval(addOnCode)
  await RecurlyClient.promises.applySubscriptionChangeRequest(changeRequest)
  await syncSubscription({ uuid: subscription.id }, userId)
}

/**
 * Returns the Recurly UUID for the given user
 *
 * Throws a NotFoundError if the subscription can't be found
 *
 * @param {string} userId
 * @return {Promise<RecurlySubscription>}
 */
async function getSubscriptionForUser(userId) {
  const subscription =
    await SubscriptionLocator.promises.getUsersSubscription(userId)
  const recurlyId = subscription?.recurlySubscription_id
  if (recurlyId == null) {
    throw new NotFoundError({
      message: 'Recurly subscription not found',
      info: { userId },
    })
  }

  try {
    const subscription = await RecurlyClient.promises.getSubscription(recurlyId)
    return subscription
  } catch (err) {
    if (err instanceof recurly.errors.NotFoundError) {
      throw new NotFoundError({
        message: 'Subscription not found',
        info: { userId, recurlyId },
      })
    } else {
      throw err
    }
  }
}

async function pauseSubscription(user, pauseCycles) {
  // only allow pausing on monthly plans not in a trial
  const { subscription } =
    await LimitationsManager.promises.userHasSubscription(user)
  if (!subscription || !subscription.recurlyStatus) {
    throw new Error('No active subscription to pause')
  }

  if (
    !subscription.planCode ||
    subscription.planCode.includes('ann') ||
    subscription.groupPlan
  ) {
    throw new Error('Can only pause monthly individual plans')
  }
  if (
    subscription.recurlyStatus.trialEndsAt &&
    subscription.recurlyStatus.trialEndsAt > new Date()
  ) {
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
  if (!subscription || !subscription.recurlyStatus) {
    throw new Error('No active subscription to resume')
  }
  await RecurlyClient.promises.resumeSubscriptionByUuid(
    subscription.recurlySubscription_id
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
  },
}
