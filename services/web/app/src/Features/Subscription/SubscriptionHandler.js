const async = require('async')
const RecurlyWrapper = require('./RecurlyWrapper')
const { User } = require('../../models/User')
const { promisifyAll } = require('../../util/promises')
const logger = require('logger-sharelatex')
const SubscriptionUpdater = require('./SubscriptionUpdater')
const LimitationsManager = require('./LimitationsManager')
const EmailHandler = require('../Email/EmailHandler')
const Analytics = require('../Analytics/AnalyticsManager')

const SubscriptionHandler = {
  validateNoSubscriptionInRecurly(userId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    RecurlyWrapper.listAccountActiveSubscriptions(
      userId,
      function (error, subscriptions) {
        if (subscriptions == null) {
          subscriptions = []
        }
        if (error != null) {
          return callback(error)
        }
        if (subscriptions.length > 0) {
          SubscriptionUpdater.syncSubscription(
            subscriptions[0],
            userId,
            function (error) {
              if (error != null) {
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
  },

  createSubscription(user, subscriptionDetails, recurlyTokenIds, callback) {
    SubscriptionHandler.validateNoSubscriptionInRecurly(
      user._id,
      function (error, valid) {
        if (error != null) {
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
            if (error != null) {
              return callback(error)
            }
            return SubscriptionUpdater.syncSubscription(
              recurlySubscription,
              user._id,
              function (error) {
                if (error != null) {
                  return callback(error)
                }
                return callback()
              }
            )
          }
        )
      }
    )
  },

  updateSubscription(user, planCode, couponCode, callback) {
    LimitationsManager.userHasV2Subscription(
      user,
      function (err, hasSubscription, subscription) {
        if (err) {
          logger.warn(
            { err, user_id: user._id, hasSubscription },
            'there was an error checking user v2 subscription'
          )
        }
        if (!hasSubscription) {
          return callback()
        } else {
          return async.series(
            [
              function (cb) {
                if (couponCode == null) {
                  return cb()
                }
                RecurlyWrapper.getSubscription(
                  subscription.recurlySubscription_id,
                  { includeAccount: true },
                  function (err, usersSubscription) {
                    if (err != null) {
                      return callback(err)
                    }
                    RecurlyWrapper.redeemCoupon(
                      usersSubscription.account.account_code,
                      couponCode,
                      cb
                    )
                  }
                )
              },
              cb =>
                RecurlyWrapper.updateSubscription(
                  subscription.recurlySubscription_id,
                  { plan_code: planCode, timeframe: 'now' },
                  function (error, recurlySubscription) {
                    if (error != null) {
                      return callback(error)
                    }
                    SubscriptionUpdater.syncSubscription(
                      recurlySubscription,
                      user._id,
                      cb
                    )
                  }
                ),
            ],
            callback
          )
        }
      }
    )
  },

  cancelSubscription(user, callback) {
    LimitationsManager.userHasV2Subscription(
      user,
      function (err, hasSubscription, subscription) {
        if (err) {
          logger.warn(
            { err, user_id: user._id, hasSubscription },
            'there was an error checking user v2 subscription'
          )
        }
        if (hasSubscription) {
          RecurlyWrapper.cancelSubscription(
            subscription.recurlySubscription_id,
            function (error) {
              if (error != null) {
                return callback(error)
              }
              const emailOpts = {
                to: user.email,
                first_name: user.first_name,
              }
              const ONE_HOUR_IN_MS = 1000 * 60 * 60
              setTimeout(
                () =>
                  EmailHandler.sendEmail(
                    'canceledSubscription',
                    emailOpts,
                    err => {
                      if (err != null) {
                        logger.warn(
                          { err },
                          'failed to send confirmation email for subscription cancellation'
                        )
                      }
                    }
                  ),
                ONE_HOUR_IN_MS
              )
              Analytics.recordEvent(user._id, 'subscription-canceled')
              callback()
            }
          )
        } else {
          callback()
        }
      }
    )
  },

  reactivateSubscription(user, callback) {
    LimitationsManager.userHasV2Subscription(
      user,
      function (err, hasSubscription, subscription) {
        if (err) {
          logger.warn(
            { err, user_id: user._id, hasSubscription },
            'there was an error checking user v2 subscription'
          )
        }
        if (hasSubscription) {
          RecurlyWrapper.reactivateSubscription(
            subscription.recurlySubscription_id,
            function (error) {
              if (error != null) {
                return callback(error)
              }
              EmailHandler.sendEmail(
                'reactivatedSubscription',
                { to: user.email },
                err => {
                  if (err != null) {
                    logger.warn(
                      { err },
                      'failed to send reactivation confirmation email'
                    )
                  }
                }
              )
              Analytics.recordEvent(user._id, 'subscription-reactivated')
              callback()
            }
          )
        } else {
          callback()
        }
      }
    )
  },

  syncSubscription(recurlySubscription, requesterData, callback) {
    RecurlyWrapper.getSubscription(
      recurlySubscription.uuid,
      { includeAccount: true },
      function (error, recurlySubscription) {
        if (error != null) {
          return callback(error)
        }
        User.findById(
          recurlySubscription.account.account_code,
          { _id: 1 },
          function (error, user) {
            if (error != null) {
              return callback(error)
            }
            if (user == null) {
              return callback(new Error('no user found'))
            }
            SubscriptionUpdater.syncSubscription(
              recurlySubscription,
              user != null ? user._id : undefined,
              requesterData,
              callback
            )
          }
        )
      }
    )
  },

  // attempt to collect past due invoice for customer. Only do that when a) the
  // customer is using Paypal and b) there is only one past due invoice.
  // This is used because Recurly doesn't always attempt collection of paast due
  // invoices after Paypal billing info were updated.
  attemptPaypalInvoiceCollection(recurlyAccountCode, callback) {
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
  },

  extendTrial(subscription, daysToExend, callback) {
    return RecurlyWrapper.extendTrial(
      subscription.recurlySubscription_id,
      daysToExend,
      callback
    )
  },
}

SubscriptionHandler.promises = promisifyAll(SubscriptionHandler)
module.exports = SubscriptionHandler
