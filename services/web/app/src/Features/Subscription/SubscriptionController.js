const SessionManager = require('../Authentication/SessionManager')
const SubscriptionHandler = require('./SubscriptionHandler')
const PlansLocator = require('./PlansLocator')
const SubscriptionViewModelBuilder = require('./SubscriptionViewModelBuilder')
const LimitationsManager = require('./LimitationsManager')
const RecurlyWrapper = require('./RecurlyWrapper')
const Settings = require('@overleaf/settings')
const logger = require('logger-sharelatex')
const GeoIpLookup = require('../../infrastructure/GeoIpLookup')
const FeaturesUpdater = require('./FeaturesUpdater')
const planFeatures = require('./planFeatures')
const GroupPlansData = require('./GroupPlansData')
const V1SubscriptionManager = require('./V1SubscriptionManager')
const Errors = require('../Errors/Errors')
const HttpErrorHandler = require('../Errors/HttpErrorHandler')
const SubscriptionErrors = require('./Errors')
const SplitTestHandler = require('../SplitTests/SplitTestHandler')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const RecurlyEventHandler = require('./RecurlyEventHandler')
const { expressify } = require('../../util/promises')
const OError = require('@overleaf/o-error')

const SUBSCRIPTION_PAGE_SPLIT_TEST = 'subscription-page'

async function plansPage(req, res) {
  const plans = SubscriptionViewModelBuilder.buildPlansList()

  const {
    currencyCode: recommendedCurrency,
  } = await GeoIpLookup.promises.getCurrencyCode(
    (req.query ? req.query.ip : undefined) || req.ip
  )

  res.render('subscriptions/plans', {
    title: 'plans_and_pricing',
    plans,
    gaExperiments: Settings.gaExperiments.plansPage,
    gaOptimize: true,
    recomendedCurrency: recommendedCurrency,
    planFeatures,
    groupPlans: GroupPlansData,
  })
}

// get to show the recurly.js page
async function paymentPage(req, res) {
  const user = SessionManager.getSessionUser(req.session)
  const plan = PlansLocator.findLocalPlanInSettings(req.query.planCode)
  if (!plan) {
    return HttpErrorHandler.unprocessableEntity(req, res, 'Plan not found')
  }
  const hasSubscription = await LimitationsManager.promises.userHasV1OrV2Subscription(
    user
  )
  if (hasSubscription) {
    res.redirect('/user/subscription?hasSubscription=true')
  } else {
    // LimitationsManager.userHasV2Subscription only checks Mongo. Double check with
    // Recurly as well at this point (we don't do this most places for speed).
    const valid = await SubscriptionHandler.promises.validateNoSubscriptionInRecurly(
      user._id
    )
    if (!valid) {
      res.redirect('/user/subscription?hasSubscription=true')
    } else {
      let currency = req.query.currency
        ? req.query.currency.toUpperCase()
        : undefined
      const {
        currencyCode: recommendedCurrency,
        countryCode,
      } = await GeoIpLookup.promises.getCurrencyCode(
        (req.query ? req.query.ip : undefined) || req.ip
      )
      if (recommendedCurrency && currency == null) {
        currency = recommendedCurrency
      }
      res.render('subscriptions/new', {
        title: 'subscribe',
        currency,
        countryCode,
        plan,
        showStudentPlan: req.query.ssp === 'true',
        recurlyConfig: JSON.stringify({
          currency,
          subdomain: Settings.apis.recurly.subdomain,
        }),
        showCouponField: !!req.query.scf,
        showVatField: !!req.query.svf,
        gaOptimize: true,
      })
    }
  }
}

async function userSubscriptionPage(req, res) {
  const user = SessionManager.getSessionUser(req.session)
  const results = await SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
    user
  )
  const {
    personalSubscription,
    memberGroupSubscriptions,
    managedGroupSubscriptions,
    currentInstitutionsWithLicence,
    managedInstitutions,
    managedPublishers,
    v1SubscriptionStatus,
  } = results
  const hasSubscription = await LimitationsManager.promises.userHasV1OrV2Subscription(
    user
  )
  const fromPlansPage = req.query.hasSubscription
  const plans = SubscriptionViewModelBuilder.buildPlansList(
    personalSubscription ? personalSubscription.plan : undefined
  )

  let subscriptionCopy = 'default'
  if (
    personalSubscription ||
    hasSubscription ||
    (memberGroupSubscriptions && memberGroupSubscriptions.length > 0) ||
    currentInstitutionsWithLicence.length > 0
  ) {
    AnalyticsManager.recordEvent(user._id, 'subscription-page-view')
  } else {
    try {
      const testSegmentation = await SplitTestHandler.promises.getTestSegmentation(
        user._id,
        SUBSCRIPTION_PAGE_SPLIT_TEST
      )
      if (testSegmentation.enabled) {
        subscriptionCopy = testSegmentation.variant

        AnalyticsManager.recordEvent(user._id, 'subscription-page-view', {
          splitTestId: SUBSCRIPTION_PAGE_SPLIT_TEST,
          splitTestVariantId: testSegmentation.variant,
        })
      } else {
        AnalyticsManager.recordEvent(user._id, 'subscription-page-view')
      }
    } catch (error) {
      logger.error(
        { err: error },
        `Failed to get segmentation for user '${user._id}' and split test '${SUBSCRIPTION_PAGE_SPLIT_TEST}'`
      )
      AnalyticsManager.recordEvent(user._id, 'subscription-page-view')
    }
  }

  const data = {
    title: 'your_subscription',
    plans,
    user,
    hasSubscription,
    subscriptionCopy,
    fromPlansPage,
    personalSubscription,
    memberGroupSubscriptions,
    managedGroupSubscriptions,
    managedInstitutions,
    managedPublishers,
    v1SubscriptionStatus,
    currentInstitutionsWithLicence,
  }
  res.render('subscriptions/dashboard', data)
}

function createSubscription(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  const recurlyTokenIds = {
    billing: req.body.recurly_token_id,
    threeDSecureActionResult:
      req.body.recurly_three_d_secure_action_result_token_id,
  }
  const { subscriptionDetails } = req.body

  LimitationsManager.userHasV1OrV2Subscription(
    user,
    function (err, hasSubscription) {
      if (err) {
        return next(err)
      }
      if (hasSubscription) {
        logger.warn({ user_id: user._id }, 'user already has subscription')
        return res.sendStatus(409) // conflict
      }
      return SubscriptionHandler.createSubscription(
        user,
        subscriptionDetails,
        recurlyTokenIds,
        function (err) {
          if (!err) {
            return res.sendStatus(201)
          }

          if (
            err instanceof SubscriptionErrors.RecurlyTransactionError ||
            err instanceof Errors.InvalidError
          ) {
            logger.error({ err }, 'recurly transaction error, potential 422')
            HttpErrorHandler.unprocessableEntity(
              req,
              res,
              err.message,
              OError.getFullInfo(err).public
            )
          } else {
            logger.warn(
              { err, user_id: user._id },
              'something went wrong creating subscription'
            )
            next(err)
          }
        }
      )
    }
  )
}

function successfulSubscription(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  return SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel(
    user,
    function (error, { personalSubscription }) {
      if (error) {
        return next(error)
      }
      if (personalSubscription == null) {
        res.redirect('/user/subscription/plans')
      } else {
        res.render('subscriptions/successful_subscription', {
          title: 'thank_you',
          personalSubscription,
        })
      }
    }
  )
}

function cancelSubscription(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  logger.log({ user_id: user._id }, 'canceling subscription')
  SubscriptionHandler.cancelSubscription(user, function (err) {
    if (err) {
      OError.tag(err, 'something went wrong canceling subscription', {
        user_id: user._id,
      })
      return next(err)
    }
    // Note: this redirect isn't used in the main flow as the redirection is
    // handled by Angular
    res.redirect('/user/subscription/canceled')
  })
}

function canceledSubscription(req, res, next) {
  return res.render('subscriptions/canceled_subscription', {
    title: 'subscription_canceled',
  })
}

function cancelV1Subscription(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  logger.log({ userId }, 'canceling v1 subscription')
  V1SubscriptionManager.cancelV1Subscription(userId, function (err) {
    if (err) {
      OError.tag(err, 'something went wrong canceling v1 subscription', {
        userId,
      })
      return next(err)
    }
    res.redirect('/user/subscription')
  })
}

function updateSubscription(req, res, next) {
  const origin = req && req.query ? req.query.origin : null
  const user = SessionManager.getSessionUser(req.session)
  const planCode = req.body.plan_code
  if (planCode == null) {
    const err = new Error('plan_code is not defined')
    logger.warn(
      { user_id: user._id, err, planCode, origin, body: req.body },
      '[Subscription] error in updateSubscription form'
    )
    return next(err)
  }
  logger.log({ planCode, user_id: user._id }, 'updating subscription')
  SubscriptionHandler.updateSubscription(user, planCode, null, function (err) {
    if (err) {
      OError.tag(err, 'something went wrong updating subscription', {
        user_id: user._id,
      })
      return next(err)
    }
    res.redirect('/user/subscription')
  })
}

function cancelPendingSubscriptionChange(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  logger.log({ user_id: user._id }, 'canceling pending subscription change')
  SubscriptionHandler.cancelPendingSubscriptionChange(user, function (err) {
    if (err) {
      OError.tag(
        err,
        'something went wrong canceling pending subscription change',
        {
          user_id: user._id,
        }
      )
      return next(err)
    }
    res.redirect('/user/subscription')
  })
}

function updateAccountEmailAddress(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  RecurlyWrapper.updateAccountEmailAddress(
    user._id,
    user.email,
    function (error) {
      if (error) {
        return next(error)
      }
      res.sendStatus(200)
    }
  )
}

function reactivateSubscription(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  logger.log({ user_id: user._id }, 'reactivating subscription')
  SubscriptionHandler.reactivateSubscription(user, function (err) {
    if (err) {
      OError.tag(err, 'something went wrong reactivating subscription', {
        user_id: user._id,
      })
      return next(err)
    }
    res.redirect('/user/subscription')
  })
}

function recurlyCallback(req, res, next) {
  logger.log({ data: req.body }, 'received recurly callback')
  const event = Object.keys(req.body)[0]
  const eventData = req.body[event]

  RecurlyEventHandler.sendRecurlyAnalyticsEvent(event, eventData)

  if (
    [
      'new_subscription_notification',
      'updated_subscription_notification',
      'expired_subscription_notification',
    ].includes(event)
  ) {
    const recurlySubscription = eventData.subscription
    SubscriptionHandler.syncSubscription(
      recurlySubscription,
      { ip: req.ip },
      function (err) {
        if (err) {
          return next(err)
        }
        res.sendStatus(200)
      }
    )
  } else if (event === 'billing_info_updated_notification') {
    const recurlyAccountCode = eventData.account.account_code
    SubscriptionHandler.attemptPaypalInvoiceCollection(
      recurlyAccountCode,
      function (err) {
        if (err) {
          return next(err)
        }
        res.sendStatus(200)
      }
    )
  } else {
    res.sendStatus(200)
  }
}

function renderUpgradeToAnnualPlanPage(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  LimitationsManager.userHasV2Subscription(
    user,
    function (err, hasSubscription, subscription) {
      let planName
      if (err) {
        return next(err)
      }
      const planCode = subscription
        ? subscription.planCode.toLowerCase()
        : undefined
      if ((planCode ? planCode.indexOf('annual') : undefined) !== -1) {
        planName = 'annual'
      } else if ((planCode ? planCode.indexOf('student') : undefined) !== -1) {
        planName = 'student'
      } else if (
        (planCode ? planCode.indexOf('collaborator') : undefined) !== -1
      ) {
        planName = 'collaborator'
      }
      if (hasSubscription) {
        res.render('subscriptions/upgradeToAnnual', {
          title: 'Upgrade to annual',
          planName,
        })
      } else {
        res.redirect('/user/subscription/plans')
      }
    }
  )
}

function processUpgradeToAnnualPlan(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  const { planName } = req.body
  const couponCode = Settings.coupon_codes.upgradeToAnnualPromo[planName]
  const annualPlanName = `${planName}-annual`
  logger.log(
    { user_id: user._id, planName: annualPlanName },
    'user is upgrading to annual billing with discount'
  )
  return SubscriptionHandler.updateSubscription(
    user,
    annualPlanName,
    couponCode,
    function (err) {
      if (err) {
        OError.tag(err, 'error updating subscription', {
          user_id: user._id,
        })
        return next(err)
      }
      res.sendStatus(200)
    }
  )
}

async function extendTrial(req, res) {
  const user = SessionManager.getSessionUser(req.session)
  const {
    subscription,
  } = await LimitationsManager.promises.userHasV2Subscription(user)

  try {
    await SubscriptionHandler.promises.extendTrial(subscription, 14)
  } catch (error) {
    return res.sendStatus(500)
  }
  res.sendStatus(200)
}

function recurlyNotificationParser(req, res, next) {
  let xml = ''
  req.on('data', chunk => (xml += chunk))
  req.on('end', () =>
    RecurlyWrapper._parseXml(xml, function (error, body) {
      if (error) {
        return next(error)
      }
      req.body = body
      next()
    })
  )
}

async function refreshUserFeatures(req, res) {
  const { user_id: userId } = req.params
  await FeaturesUpdater.promises.refreshFeatures(userId)
  res.sendStatus(200)
}

module.exports = {
  plansPage: expressify(plansPage),
  paymentPage: expressify(paymentPage),
  userSubscriptionPage: expressify(userSubscriptionPage),
  createSubscription,
  successfulSubscription,
  cancelSubscription,
  canceledSubscription,
  cancelV1Subscription,
  updateSubscription,
  cancelPendingSubscriptionChange,
  updateAccountEmailAddress,
  reactivateSubscription,
  recurlyCallback,
  renderUpgradeToAnnualPlanPage,
  processUpgradeToAnnualPlan,
  extendTrial: expressify(extendTrial),
  recurlyNotificationParser,
  refreshUserFeatures: expressify(refreshUserFeatures),
}
