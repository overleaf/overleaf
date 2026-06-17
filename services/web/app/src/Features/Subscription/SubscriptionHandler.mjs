// @ts-check

import RecurlyWrapper from './RecurlyWrapper.mjs'

import { User } from '../../models/User.mjs'
import logger from '@overleaf/logger'
import SubscriptionHelper from './SubscriptionHelper.mjs'
import SubscriptionUpdater from './SubscriptionUpdater.mjs'
import LimitationsManager from './LimitationsManager.mjs'
import EmailHandler from '../Email/EmailHandler.mjs'
import { callbackify } from '@overleaf/promise-utils'
import Modules from '../../infrastructure/Modules.mjs'
import { AI_ADD_ON_CODE } from './AiHelper.mjs'
import CustomerIoPlanHelpers from './CustomerIoPlanHelpers.mjs'
import WorkbenchRateLimiter from '../../infrastructure/rate-limiters/WorkbenchRateLimiter.mjs'
import AiFeatureUsageRateLimiter from '../../infrastructure/rate-limiters/AiFeatureUsageRateLimiter.mjs'

/**
 * @import { PaymentProviderSubscriptionChange } from './PaymentProviderEntities.mjs'
 */

/**
 * Preview the effect of changing the subscription plan
 *
 * @param {string} userId
 * @param {string} planCode
 * @return {Promise<PaymentProviderSubscriptionChange>}
 */
async function previewSubscriptionChange(userId, planCode) {
  const change = await Modules.promises.hooks.fire(
    'previewPlanChange',
    userId,
    planCode
  )
  return change[0]
}

/**
 * @param user
 * @param {any} user
 * @param {any} planCode
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

  const previousPlanType = CustomerIoPlanHelpers.normalizePlanType({
    plan: {
      planCode: subscription.planCode,
      groupPlan: subscription.groupPlan,
    },
  })

  await Modules.promises.hooks.fire(
    'updatePaidSubscription',
    subscription,
    planCode,
    user._id
  )

  try {
    await WorkbenchRateLimiter.resetTokenUsage(user._id)
    await AiFeatureUsageRateLimiter.resetFeatureUsage(user._id)
  } catch (err) {
    logger.error({ err, userId: user._id }, 'failed to reset AI usage limits')
  }

  const newPlanType =
    CustomerIoPlanHelpers.normalizePlanTypeFromPlanCode(planCode)
  if (previousPlanType && previousPlanType !== newPlanType) {
    Modules.promises.hooks
      .fire('setUserProperties', user._id, {
        previous_plan_type: previousPlanType,
      })
      .catch(err => {
        logger.warn(
          { err, userId: user._id },
          'Failed to set previous_plan_type in customer.io'
        )
      })
  }
}

/**
 * @param {any} user
 */
async function cancelPendingSubscriptionChange(user) {
  const { hasSubscription, subscription } =
    await LimitationsManager.promises.userHasSubscription(user)

  if (hasSubscription && subscription != null) {
    const [paymentRecord] = await Modules.promises.hooks.fire(
      'getPaymentFromRecord',
      subscription
    )

    if (paymentRecord != null) {
      const changeRequest =
        paymentRecord.subscription.getRequestForPlanChangeCancellation()

      if (changeRequest) {
        // There are pending add-on changes to preserve, apply the change request
        await Modules.promises.hooks.fire(
          'applySubscriptionChangeRequestAndSync',
          changeRequest,
          user._id.toString()
        )
      } else if (paymentRecord.subscription.pendingChange != null) {
        // No add-on changes to preserve, just remove the pending change
        await Modules.promises.hooks.fire(
          'cancelPendingPaidSubscriptionChange',
          subscription
        )
      }
    }
  }
}

/**
 * Send cancellation email to user with split test for AI Assist addon
 * @param {any} user
 */
async function _sendCancellationEmail(user) {
  const emailOpts = {
    to: user.email,
    first_name: user.first_name,
  }

  const ONE_HOUR_IN_MS = 1000 * 60 * 60

  logger.debug(
    { userId: user._id },
    'deferred email: canceledSubscriptionOrAddOn'
  )

  EmailHandler.sendDeferredEmail(
    'canceledSubscriptionOrAddOn',
    emailOpts,
    ONE_HOUR_IN_MS
  )
}

/**
 * @param {any} user
 */
async function cancelSubscription(user) {
  const { hasSubscription, subscription } =
    await LimitationsManager.promises.userHasSubscription(user)
  if (hasSubscription && subscription != null) {
    await Modules.promises.hooks.fire('cancelPaidSubscription', subscription)

    await _sendCancellationEmail(user)
  }
}

/**
 * @param {any} user
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
 * @param {any} recurlySubscription
 * @param {any} requesterData
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
 * @param {any} recurlyAccountCode
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

/**
 * @param {any} subscription
 * @param {any} daysToExtend
 */
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
 * Cancels an add-on for a user
 *
 * @param {any} user
 * @param {string} addOnCode
 */
async function removeAddon(user, addOnCode) {
  await Modules.promises.hooks.fire('removeAddOn', user._id, addOnCode)

  if (addOnCode === AI_ADD_ON_CODE) {
    await _sendCancellationEmail(user)
  }
}

/**
 * Reactivates an add-on pending cancellation
 *
 * @param {string} userId
 * @param {string} addOnCode
 */
async function reactivateAddon(userId, addOnCode) {
  await Modules.promises.hooks.fire('reactivateAddOn', userId, addOnCode)
}

/**
 * @param {any} user
 * @param {any} pauseCycles
 */
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

  await Modules.promises.hooks.fire(
    'pausePaidSubscription',
    subscription,
    pauseCycles
  )
}
/**
 * @param {any} user
 */ async function resumeSubscription(user) {
  const { subscription } =
    await LimitationsManager.promises.userHasSubscription(user)
  if (
    !subscription ||
    !SubscriptionHelper.getPaidSubscriptionState(subscription)
  ) {
    throw new Error('No active subscription to resume')
  }
  await Modules.promises.hooks.fire('resumePaidSubscription', subscription)
}

export default {
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
  reactivateAddon: callbackify(reactivateAddon),
  pauseSubscription: callbackify(pauseSubscription),
  resumeSubscription: callbackify(resumeSubscription),
  promises: {
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
    reactivateAddon,
    pauseSubscription,
    resumeSubscription,
  },
}
