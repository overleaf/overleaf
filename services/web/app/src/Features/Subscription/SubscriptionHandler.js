const RecurlyWrapper = require('./RecurlyWrapper')
const RecurlyClient = require('./RecurlyClient')
const { User } = require('../../models/User')
const logger = require('@overleaf/logger')
const SubscriptionUpdater = require('./SubscriptionUpdater')
const LimitationsManager = require('./LimitationsManager')
const EmailHandler = require('../Email/EmailHandler')
const PlansLocator = require('./PlansLocator')
const SubscriptionHelper = require('./SubscriptionHelper')
const { callbackify } = require('@overleaf/promise-utils')
const UserUpdater = require('../User/UserUpdater')
const {
  DuplicateAddOnError,
  AddOnNotPresentError,
  NoRecurlySubscriptionError,
} = require('./Errors')

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

async function updateSubscription(user, planCode, couponCode) {
  let hasSubscription = false
  let subscription

  try {
    ;({ hasSubscription, subscription } =
      await LimitationsManager.promises.userHasV2Subscription(user))
  } catch (err) {
    logger.warn(
      { err, userId: user._id },
      'there was an error checking user v2 subscription'
    )
  }

  if (!hasSubscription) {
    return
  }

  if (couponCode) {
    const usersSubscription = await RecurlyWrapper.promises.getSubscription(
      subscription.recurlySubscription_id,
      { includeAccount: true }
    )

    await RecurlyWrapper.promises.redeemCoupon(
      usersSubscription.account.account_code,
      couponCode
    )
  }
  let changeAtTermEnd

  const currentPlan = PlansLocator.findLocalPlanInSettings(
    subscription.planCode
  )
  const newPlan = PlansLocator.findLocalPlanInSettings(planCode)
  if (currentPlan && newPlan) {
    changeAtTermEnd = SubscriptionHelper.shouldPlanChangeAtTermEnd(
      currentPlan,
      newPlan
    )
  } else {
    logger.error(
      { currentPlan: subscription.planCode, newPlan: planCode },
      'unable to locate both plans in settings'
    )
    throw new Error('unable to locate both plans in settings')
  }

  const timeframe = changeAtTermEnd ? 'term_end' : 'now'
  const subscriptionChangeOptions = { planCode, timeframe }
  await _updateAndSyncSubscription(
    user,
    subscription.recurlySubscription_id,
    subscriptionChangeOptions
  )
}

async function _updateAndSyncSubscription(
  user,
  recurlySubscriptionId,
  subscriptionChangeOptions
) {
  await RecurlyClient.promises.changeSubscriptionByUuid(
    recurlySubscriptionId,
    subscriptionChangeOptions
  )

  // v2 recurly API wants a UUID, but UUID isn't included in the subscription change response
  // we got the UUID from the DB using userHasV2Subscription() - it is the only property
  // we need to be able to build a 'recurlySubscription' object for syncSubscription()
  await syncSubscription({ uuid: recurlySubscriptionId }, user._id)
}

async function cancelPendingSubscriptionChange(user) {
  const { hasSubscription, subscription } =
    await LimitationsManager.promises.userHasV2Subscription(user)

  if (hasSubscription) {
    await RecurlyClient.promises.removeSubscriptionChangeByUuid(
      subscription.recurlySubscription_id
    )
  }
}

async function cancelSubscription(user) {
  try {
    const { hasSubscription, subscription } =
      await LimitationsManager.promises.userHasV2Subscription(user)
    if (hasSubscription) {
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

async function reactivateSubscription(user) {
  try {
    const { hasSubscription, subscription } =
      await LimitationsManager.promises.userHasV2Subscription(user)
    if (hasSubscription) {
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

// attempt to collect past due invoice for customer. Only do that when a) the
// customer is using Paypal and b) there is only one past due invoice.
// This is used because Recurly doesn't always attempt collection of paast due
// invoices after Paypal billing info were updated.
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

async function _getSubscription(user) {
  const { hasSubscription = false, subscription } =
    await LimitationsManager.promises.userHasV2Subscription(user)

  if (!hasSubscription || !subscription?.recurlySubscription_id) {
    throw new NoRecurlySubscriptionError(
      "could not fetch the user's Recurly subscription",
      { userId: user._id }
    )
  }

  const currentSub = await RecurlyClient.promises.getSubscription(
    `uuid-${subscription.recurlySubscription_id}`
  )
  return currentSub
}

async function purchaseAddon(user, addOnCode, quantity) {
  const subscription = await _getSubscription(user)
  const currentAddons = subscription?.addOns || []

  const hasAddon = currentAddons.some(addOn => addOn.addOn.code === addOnCode)
  if (hasAddon) {
    throw new DuplicateAddOnError('User already has add-on', {
      userId: user._id,
      addOnCode,
    })
  }
  const addOns = [...currentAddons, { code: addOnCode, quantity }]
  const subscriptionChangeOptions = { addOns, timeframe: 'now' }

  await _updateAndSyncSubscription(
    user,
    subscription.uuid,
    subscriptionChangeOptions
  )
}

async function removeAddon(user, addOnCode) {
  const subscription = await _getSubscription(user)
  const currentAddons = subscription?.addOns || []

  const hasAddon = currentAddons.some(addOn => addOn.addOn.code === addOnCode)
  if (!hasAddon) {
    throw new AddOnNotPresentError('User does not have add-on to remove', {
      userId: user._id,
      addOnCode,
    })
  }
  const addOns = currentAddons.filter(addOn => addOn.addOn.code !== addOnCode)
  const subscriptionChangeOptions = { addOns, timeframe: 'term_end' }
  await _updateAndSyncSubscription(
    user,
    subscription.uuid,
    subscriptionChangeOptions
  )
}

module.exports = {
  validateNoSubscriptionInRecurly: callbackify(validateNoSubscriptionInRecurly),
  createSubscription: callbackify(createSubscription),
  updateSubscription: callbackify(updateSubscription),
  cancelPendingSubscriptionChange: callbackify(cancelPendingSubscriptionChange),
  cancelSubscription: callbackify(cancelSubscription),
  reactivateSubscription: callbackify(reactivateSubscription),
  syncSubscription: callbackify(syncSubscription),
  attemptPaypalInvoiceCollection: callbackify(attemptPaypalInvoiceCollection),
  extendTrial: callbackify(extendTrial),
  purchaseAddon: callbackify(purchaseAddon),
  removeAddon: callbackify(removeAddon),
  promises: {
    validateNoSubscriptionInRecurly,
    createSubscription,
    updateSubscription,
    cancelPendingSubscriptionChange,
    cancelSubscription,
    reactivateSubscription,
    syncSubscription,
    attemptPaypalInvoiceCollection,
    extendTrial,
    purchaseAddon,
    removeAddon,
  },
}
