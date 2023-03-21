const async = require('async')
const { promisify } = require('util')
const RecurlyWrapper = require('./RecurlyWrapper')
const RecurlyClient = require('./RecurlyClient')
const { User } = require('../../models/User')
const logger = require('@overleaf/logger')
const SubscriptionUpdater = require('./SubscriptionUpdater')
const LimitationsManager = require('./LimitationsManager')
const EmailHandler = require('../Email/EmailHandler')
const PlansLocator = require('./PlansLocator')
const SubscriptionHelper = require('./SubscriptionHelper')

function validateNoSubscriptionInRecurly(userId, callback) {
  RecurlyWrapper.listAccountActiveSubscriptions(
    userId,
    function (error, subscriptions) {
      if (!subscriptions) {
        subscriptions = []
      }
      if (error) {
        return callback(error)
      }
      if (subscriptions.length > 0) {
        SubscriptionUpdater.syncSubscription(
          subscriptions[0],
          userId,
          function (error) {
            if (error) {
              return callback(error)
            }
            callback(null, false)
          }
        )
      } else {
        callback(null, true)
      }
    }
  )
}

function createSubscription(
  user,
  subscriptionDetails,
  recurlyTokenIds,
  callback
) {
  validateNoSubscriptionInRecurly(user._id, function (error, valid) {
    if (error) {
      return callback(error)
    }
    if (!valid) {
      return callback(new Error('user already has subscription in recurly'))
    }
    RecurlyWrapper.createSubscription(
      user,
      subscriptionDetails,
      recurlyTokenIds,
      function (error, recurlySubscription) {
        if (error) {
          return callback(error)
        }
        SubscriptionUpdater.syncSubscription(
          recurlySubscription,
          user._id,
          function (error) {
            if (error) {
              return callback(error)
            }
            callback()
          }
        )
      }
    )
  })
}

function updateSubscription(user, planCode, couponCode, callback) {
  LimitationsManager.userHasV2Subscription(
    user,
    function (err, hasSubscription, subscription) {
      if (err) {
        logger.warn(
          { err, userId: user._id, hasSubscription },
          'there was an error checking user v2 subscription'
        )
      }
      if (!hasSubscription) {
        callback()
      } else {
        async.series(
          [
            function (cb) {
              if (!couponCode) {
                return cb()
              }
              RecurlyWrapper.getSubscription(
                subscription.recurlySubscription_id,
                { includeAccount: true },
                function (err, usersSubscription) {
                  if (err) {
                    return cb(err)
                  }
                  RecurlyWrapper.redeemCoupon(
                    usersSubscription.account.account_code,
                    couponCode,
                    cb
                  )
                }
              )
            },
            function (cb) {
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
                return cb(new Error('unable to locate both plans in settings'))
              }
              const timeframe = changeAtTermEnd ? 'term_end' : 'now'
              RecurlyClient.changeSubscriptionByUuid(
                subscription.recurlySubscription_id,
                { planCode, timeframe },
                function (error, subscriptionChange) {
                  if (error) {
                    return cb(error)
                  }
                  // v2 recurly API wants a UUID, but UUID isn't included in the subscription change response
                  // we got the UUID from the DB using userHasV2Subscription() - it is the only property
                  // we need to be able to build a 'recurlySubscription' object for syncSubscription()
                  syncSubscription(
                    { uuid: subscription.recurlySubscription_id },
                    user._id,
                    cb
                  )
                }
              )
            },
          ],
          callback
        )
      }
    }
  )
}

function cancelPendingSubscriptionChange(user, callback) {
  LimitationsManager.userHasV2Subscription(
    user,
    function (err, hasSubscription, subscription) {
      if (err) {
        return callback(err)
      }
      if (hasSubscription) {
        RecurlyClient.removeSubscriptionChangeByUuid(
          subscription.recurlySubscription_id,
          function (error) {
            if (error) {
              return callback(error)
            }
            callback()
          }
        )
      } else {
        callback()
      }
    }
  )
}

function cancelSubscription(user, callback) {
  LimitationsManager.userHasV2Subscription(
    user,
    function (err, hasSubscription, subscription) {
      if (err) {
        logger.warn(
          { err, userId: user._id, hasSubscription },
          'there was an error checking user v2 subscription'
        )
      }
      if (hasSubscription) {
        RecurlyClient.cancelSubscriptionByUuid(
          subscription.recurlySubscription_id,
          function (error) {
            if (error) {
              return callback(error)
            }
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
            callback()
          }
        )
      } else {
        callback()
      }
    }
  )
}

function reactivateSubscription(user, callback) {
  LimitationsManager.userHasV2Subscription(
    user,
    function (err, hasSubscription, subscription) {
      if (err) {
        logger.warn(
          { err, userId: user._id, hasSubscription },
          'there was an error checking user v2 subscription'
        )
      }
      if (hasSubscription) {
        RecurlyClient.reactivateSubscriptionByUuid(
          subscription.recurlySubscription_id,
          function (error) {
            if (error) {
              return callback(error)
            }
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
            callback()
          }
        )
      } else {
        callback()
      }
    }
  )
}

function syncSubscription(recurlySubscription, requesterData, callback) {
  RecurlyWrapper.getSubscription(
    recurlySubscription.uuid,
    { includeAccount: true },
    function (error, recurlySubscription) {
      if (error) {
        return callback(error)
      }
      User.findById(
        recurlySubscription.account.account_code,
        { _id: 1 },
        function (error, user) {
          if (error) {
            return callback(error)
          }
          if (!user) {
            return callback(new Error('no user found'))
          }
          SubscriptionUpdater.syncSubscription(
            recurlySubscription,
            user._id,
            requesterData,
            callback
          )
        }
      )
    }
  )
}

// attempt to collect past due invoice for customer. Only do that when a) the
// customer is using Paypal and b) there is only one past due invoice.
// This is used because Recurly doesn't always attempt collection of paast due
// invoices after Paypal billing info were updated.
function attemptPaypalInvoiceCollection(recurlyAccountCode, callback) {
  RecurlyWrapper.getBillingInfo(recurlyAccountCode, (error, billingInfo) => {
    if (error) {
      return callback(error)
    }
    if (!billingInfo.paypal_billing_agreement_id) {
      // this is not a Paypal user
      return callback()
    }
    RecurlyWrapper.getAccountPastDueInvoices(
      recurlyAccountCode,
      (error, pastDueInvoices) => {
        if (error) {
          return callback(error)
        }
        if (pastDueInvoices.length !== 1) {
          // no past due invoices, or more than one. Ignore.
          return callback()
        }
        RecurlyWrapper.attemptInvoiceCollection(
          pastDueInvoices[0].invoice_number,
          callback
        )
      }
    )
  })
}

function extendTrial(subscription, daysToExend, callback) {
  RecurlyWrapper.extendTrial(
    subscription.recurlySubscription_id,
    daysToExend,
    callback
  )
}

module.exports = {
  validateNoSubscriptionInRecurly,
  createSubscription,
  updateSubscription,
  cancelPendingSubscriptionChange,
  cancelSubscription,
  reactivateSubscription,
  syncSubscription,
  attemptPaypalInvoiceCollection,
  extendTrial,
  promises: {
    validateNoSubscriptionInRecurly: promisify(validateNoSubscriptionInRecurly),
    createSubscription: promisify(createSubscription),
    updateSubscription: promisify(updateSubscription),
    cancelPendingSubscriptionChange: promisify(cancelPendingSubscriptionChange),
    cancelSubscription: promisify(cancelSubscription),
    reactivateSubscription: promisify(reactivateSubscription),
    syncSubscription: promisify(syncSubscription),
    attemptPaypalInvoiceCollection: promisify(attemptPaypalInvoiceCollection),
    extendTrial: promisify(extendTrial),
  },
}
