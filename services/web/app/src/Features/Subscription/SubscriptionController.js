/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let SubscriptionController
const AuthenticationController = require('../Authentication/AuthenticationController')
const SubscriptionHandler = require('./SubscriptionHandler')
const PlansLocator = require('./PlansLocator')
const SubscriptionViewModelBuilder = require('./SubscriptionViewModelBuilder')
const LimitationsManager = require('./LimitationsManager')
const RecurlyWrapper = require('./RecurlyWrapper')
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const GeoIpLookup = require('../../infrastructure/GeoIpLookup')
const UserGetter = require('../User/UserGetter')
const FeaturesUpdater = require('./FeaturesUpdater')
const planFeatures = require('./planFeatures')
const GroupPlansData = require('./GroupPlansData')
const V1SubscriptionManager = require('./V1SubscriptionManager')
const SubscriptionErrors = require('./Errors')
const HttpErrors = require('@overleaf/o-error/http')

module.exports = SubscriptionController = {
  plansPage(req, res, next) {
    const plans = SubscriptionViewModelBuilder.buildViewModel()
    let viewName = 'subscriptions/plans'
    if (req.query.v != null) {
      viewName = `${viewName}_${req.query.v}`
    }
    logger.log({ viewName }, 'showing plans page')
    let currentUser = null

    return GeoIpLookup.getCurrencyCode(
      (req.query != null ? req.query.ip : undefined) || req.ip,
      function(err, recomendedCurrency) {
        if (err != null) {
          return next(err)
        }
        const render = () =>
          res.render(viewName, {
            title: 'plans_and_pricing',
            plans,
            gaExperiments: Settings.gaExperiments.plansPage,
            recomendedCurrency,
            planFeatures,
            groupPlans: GroupPlansData
          })
        const user_id = AuthenticationController.getLoggedInUserId(req)
        if (user_id != null) {
          return UserGetter.getUser(user_id, { signUpDate: 1 }, function(
            err,
            user
          ) {
            if (err != null) {
              return next(err)
            }
            currentUser = user
            return render()
          })
        } else {
          return render()
        }
      }
    )
  },

  // get to show the recurly.js page
  paymentPage(req, res, next) {
    const user = AuthenticationController.getSessionUser(req)
    const plan = PlansLocator.findLocalPlanInSettings(req.query.planCode)
    return LimitationsManager.userHasV1OrV2Subscription(user, function(
      err,
      hasSubscription
    ) {
      if (err != null) {
        return next(err)
      }
      if (hasSubscription || plan == null) {
        return res.redirect('/user/subscription?hasSubscription=true')
      } else {
        // LimitationsManager.userHasV2Subscription only checks Mongo. Double check with
        // Recurly as well at this point (we don't do this most places for speed).
        return SubscriptionHandler.validateNoSubscriptionInRecurly(
          user._id,
          function(error, valid) {
            if (error != null) {
              return next(error)
            }
            if (!valid) {
              res.redirect('/user/subscription?hasSubscription=true')
            } else {
              let currency =
                req.query.currency != null
                  ? req.query.currency.toUpperCase()
                  : undefined
              return GeoIpLookup.getCurrencyCode(
                (req.query != null ? req.query.ip : undefined) || req.ip,
                function(err, recomendedCurrency, countryCode) {
                  if (err != null) {
                    return next(err)
                  }
                  if (recomendedCurrency != null && currency == null) {
                    currency = recomendedCurrency
                  }
                  return res.render('subscriptions/new', {
                    title: 'subscribe',
                    plan_code: req.query.planCode,
                    currency,
                    countryCode,
                    plan,
                    showStudentPlan: req.query.ssp,
                    recurlyConfig: JSON.stringify({
                      currency,
                      subdomain: Settings.apis.recurly.subdomain
                    }),
                    showCouponField: req.query.scf,
                    showVatField: req.query.svf,
                    couponCode: req.query.cc || ''
                  })
                }
              )
            }
          }
        )
      }
    })
  },

  userSubscriptionPage(req, res, next) {
    const user = AuthenticationController.getSessionUser(req)
    return SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel(
      user,
      function(error, results) {
        if (error != null) {
          return next(error)
        }
        const {
          personalSubscription,
          memberGroupSubscriptions,
          managedGroupSubscriptions,
          confirmedMemberInstitutions,
          managedInstitutions,
          managedPublishers,
          v1SubscriptionStatus
        } = results
        return LimitationsManager.userHasV1OrV2Subscription(user, function(
          err,
          hasSubscription
        ) {
          if (error != null) {
            return next(error)
          }
          const fromPlansPage = req.query.hasSubscription
          logger.log(
            {
              user,
              hasSubscription,
              fromPlansPage,
              personalSubscription,
              memberGroupSubscriptions,
              managedGroupSubscriptions,
              confirmedMemberInstitutions,
              managedInstitutions,
              managedPublishers,
              v1SubscriptionStatus
            },
            'showing subscription dashboard'
          )
          const plans = SubscriptionViewModelBuilder.buildViewModel()
          const data = {
            title: 'your_subscription',
            plans,
            user,
            hasSubscription,
            fromPlansPage,
            personalSubscription,
            memberGroupSubscriptions,
            managedGroupSubscriptions,
            confirmedMemberInstitutions,
            managedInstitutions,
            managedPublishers,
            v1SubscriptionStatus
          }
          return res.render('subscriptions/dashboard', data)
        })
      }
    )
  },

  createSubscription(req, res, next) {
    const user = AuthenticationController.getSessionUser(req)
    const recurlyTokenIds = {
      billing: req.body.recurly_token_id,
      threeDSecureActionResult:
        req.body.recurly_three_d_secure_action_result_token_id
    }
    const { subscriptionDetails } = req.body
    logger.log(
      { user_id: user._id, subscriptionDetails },
      'creating subscription'
    )

    return LimitationsManager.userHasV1OrV2Subscription(user, function(
      err,
      hasSubscription
    ) {
      if (err != null) {
        return next(err)
      }
      if (hasSubscription) {
        logger.warn({ user_id: user._id }, 'user already has subscription')
        res.sendStatus(409) // conflict
      }
      return SubscriptionHandler.createSubscription(
        user,
        subscriptionDetails,
        recurlyTokenIds,
        function(err) {
          if (!err) {
            return res.sendStatus(201)
          }

          if (err instanceof SubscriptionErrors.RecurlyTransactionError) {
            return next(
              new HttpErrors.UnprocessableEntityError({}).withCause(err)
            )
          }

          logger.warn(
            { err, user_id: user._id },
            'something went wrong creating subscription'
          )
          next(err)
        }
      )
    })
  },

  successful_subscription(req, res, next) {
    const user = AuthenticationController.getSessionUser(req)
    return SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel(
      user,
      function(error, { personalSubscription }) {
        if (error != null) {
          return next(error)
        }
        if (personalSubscription == null) {
          return res.redirect('/user/subscription/plans')
        }
        return res.render('subscriptions/successful_subscription', {
          title: 'thank_you',
          personalSubscription
        })
      }
    )
  },

  cancelSubscription(req, res, next) {
    const user = AuthenticationController.getSessionUser(req)
    logger.log({ user_id: user._id }, 'canceling subscription')
    return SubscriptionHandler.cancelSubscription(user, function(err) {
      if (err != null) {
        logger.warn(
          { err, user_id: user._id },
          'something went wrong canceling subscription'
        )
        return next(err)
      }
      // Note: this redirect isn't used in the main flow as the redirection is
      // handled by Angular
      return res.redirect('/user/subscription/canceled')
    })
  },

  canceledSubscription(req, res, next) {
    const user = AuthenticationController.getSessionUser(req)
    return res.render('subscriptions/canceled_subscription', {
      title: 'subscription_canceled'
    })
  },

  cancelV1Subscription(req, res, next) {
    const user_id = AuthenticationController.getLoggedInUserId(req)
    logger.log({ user_id }, 'canceling v1 subscription')
    return V1SubscriptionManager.cancelV1Subscription(user_id, function(err) {
      if (err != null) {
        logger.warn(
          { err, user_id },
          'something went wrong canceling v1 subscription'
        )
        return next(err)
      }
      return res.redirect('/user/subscription')
    })
  },

  updateSubscription(req, res, next) {
    const _origin =
      __guard__(req != null ? req.query : undefined, x => x.origin) || null
    const user = AuthenticationController.getSessionUser(req)
    const planCode = req.body.plan_code
    if (planCode == null) {
      const err = new Error('plan_code is not defined')
      logger.warn(
        { user_id: user._id, err, planCode, origin: _origin, body: req.body },
        '[Subscription] error in updateSubscription form'
      )
      return next(err)
    }
    logger.log({ planCode, user_id: user._id }, 'updating subscription')
    return SubscriptionHandler.updateSubscription(
      user,
      planCode,
      null,
      function(err) {
        if (err != null) {
          logger.warn(
            { err, user_id: user._id },
            'something went wrong updating subscription'
          )
          return next(err)
        }
        return res.redirect('/user/subscription')
      }
    )
  },

  reactivateSubscription(req, res, next) {
    const user = AuthenticationController.getSessionUser(req)
    logger.log({ user_id: user._id }, 'reactivating subscription')
    return SubscriptionHandler.reactivateSubscription(user, function(err) {
      if (err != null) {
        logger.warn(
          { err, user_id: user._id },
          'something went wrong reactivating subscription'
        )
        return next(err)
      }
      return res.redirect('/user/subscription')
    })
  },

  recurlyCallback(req, res, next) {
    logger.log({ data: req.body }, 'received recurly callback')
    // we only care if a subscription has exipired
    if (
      req.body != null &&
      req.body['expired_subscription_notification'] != null
    ) {
      const recurlySubscription =
        req.body['expired_subscription_notification'].subscription
      return SubscriptionHandler.recurlyCallback(
        recurlySubscription,
        { ip: req.ip },
        function(err) {
          if (err != null) {
            return next(err)
          }
          return res.sendStatus(200)
        }
      )
    } else {
      return res.sendStatus(200)
    }
  },

  renderUpgradeToAnnualPlanPage(req, res, next) {
    const user = AuthenticationController.getSessionUser(req)
    return LimitationsManager.userHasV2Subscription(user, function(
      err,
      hasSubscription,
      subscription
    ) {
      let planName
      if (err != null) {
        return next(err)
      }
      const planCode =
        subscription != null ? subscription.planCode.toLowerCase() : undefined
      if ((planCode != null ? planCode.indexOf('annual') : undefined) !== -1) {
        planName = 'annual'
      } else if (
        (planCode != null ? planCode.indexOf('student') : undefined) !== -1
      ) {
        planName = 'student'
      } else if (
        (planCode != null ? planCode.indexOf('collaborator') : undefined) !== -1
      ) {
        planName = 'collaborator'
      }
      if (!hasSubscription) {
        return res.redirect('/user/subscription/plans')
      }
      logger.log(
        { planName, user_id: user._id },
        'rendering upgrade to annual page'
      )
      return res.render('subscriptions/upgradeToAnnual', {
        title: 'Upgrade to annual',
        planName
      })
    })
  },

  processUpgradeToAnnualPlan(req, res, next) {
    const user = AuthenticationController.getSessionUser(req)
    const { planName } = req.body
    const coupon_code = Settings.coupon_codes.upgradeToAnnualPromo[planName]
    const annualPlanName = `${planName}-annual`
    logger.log(
      { user_id: user._id, planName: annualPlanName },
      'user is upgrading to annual billing with discount'
    )
    return SubscriptionHandler.updateSubscription(
      user,
      annualPlanName,
      coupon_code,
      function(err) {
        if (err != null) {
          logger.warn({ err, user_id: user._id }, 'error updating subscription')
          return next(err)
        }
        return res.sendStatus(200)
      }
    )
  },

  extendTrial(req, res, next) {
    const user = AuthenticationController.getSessionUser(req)
    return LimitationsManager.userHasV2Subscription(user, function(
      err,
      hasSubscription,
      subscription
    ) {
      if (err != null) {
        return next(err)
      }
      return SubscriptionHandler.extendTrial(subscription, 14, function(err) {
        if (err != null) {
          return res.send(500)
        } else {
          return res.send(200)
        }
      })
    })
  },

  recurlyNotificationParser(req, res, next) {
    let xml = ''
    req.on('data', chunk => (xml += chunk))
    return req.on('end', () =>
      RecurlyWrapper._parseXml(xml, function(error, body) {
        if (error != null) {
          return next(error)
        }
        req.body = body
        return next()
      })
    )
  },

  refreshUserFeatures(req, res, next) {
    const { user_id } = req.params
    return FeaturesUpdater.refreshFeatures(user_id, function(error) {
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(200)
    })
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
