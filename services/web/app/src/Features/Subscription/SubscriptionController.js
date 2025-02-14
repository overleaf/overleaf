// @ts-check

const SessionManager = require('../Authentication/SessionManager')
const SubscriptionHandler = require('./SubscriptionHandler')
const SubscriptionViewModelBuilder = require('./SubscriptionViewModelBuilder')
const LimitationsManager = require('./LimitationsManager')
const RecurlyWrapper = require('./RecurlyWrapper')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const GeoIpLookup = require('../../infrastructure/GeoIpLookup')
const FeaturesUpdater = require('./FeaturesUpdater')
const GroupPlansData = require('./GroupPlansData')
const V1SubscriptionManager = require('./V1SubscriptionManager')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const RecurlyEventHandler = require('./RecurlyEventHandler')
const { expressify } = require('@overleaf/promise-utils')
const OError = require('@overleaf/o-error')
const { DuplicateAddOnError, AddOnNotPresentError } = require('./Errors')
const SplitTestHandler = require('../SplitTests/SplitTestHandler')
const AuthorizationManager = require('../Authorization/AuthorizationManager')
const Modules = require('../../infrastructure/Modules')
const async = require('async')
const HttpErrorHandler = require('../Errors/HttpErrorHandler')
const RecurlyClient = require('./RecurlyClient')
const { AI_ADD_ON_CODE } = require('./RecurlyEntities')
const PlansLocator = require('./PlansLocator')

/**
 * @import { SubscriptionChangeDescription } from '../../../../types/subscription/subscription-change-preview'
 * @import { SubscriptionChangePreview } from '../../../../types/subscription/subscription-change-preview'
 * @import { RecurlySubscriptionChange } from './RecurlyEntities'
 * @import { PaymentMethod } from './types'
 */

const groupPlanModalOptions = Settings.groupPlanModalOptions

function formatGroupPlansDataForDash() {
  return {
    plans: [...groupPlanModalOptions.plan_codes],
    sizes: [...groupPlanModalOptions.sizes],
    sizesForHighDenominationCurrencies: [
      ...groupPlanModalOptions.sizesForHighDenominationCurrencies,
    ],
    usages: [...groupPlanModalOptions.usages],
    priceByUsageTypeAndSize: JSON.parse(JSON.stringify(GroupPlansData)),
  }
}

async function userSubscriptionPage(req, res) {
  const user = SessionManager.getSessionUser(req.session)

  await SplitTestHandler.promises.getAssignment(req, res, 'ai-add-on')

  await SplitTestHandler.promises.getAssignment(req, res, 'pause-subscription')

  const { variant: flexibleLicensingVariant } =
    await SplitTestHandler.promises.getAssignment(
      req,
      res,
      'flexible-group-licensing'
    )

  const results =
    await SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
      user,
      req.i18n.language
    )
  const {
    personalSubscription,
    memberGroupSubscriptions,
    managedGroupSubscriptions,
    currentInstitutionsWithLicence,
    managedInstitutions,
    managedPublishers,
  } = results
  const { hasSubscription } =
    await LimitationsManager.promises.userHasSubscription(user)

  const userCanExtendTrial = (
    await Modules.promises.hooks.fire('userCanExtendTrial', user)
  )?.[0]
  const fromPlansPage = req.query.hasSubscription
  const plansData =
    SubscriptionViewModelBuilder.buildPlansListForSubscriptionDash(
      personalSubscription?.plan
    )

  AnalyticsManager.recordEventForSession(req.session, 'subscription-page-view')

  const groupPlansDataForDash = formatGroupPlansDataForDash()

  // display the Group Settings button only to admins of group subscriptions with either/or the Managed Users or Group SSO feature available
  let groupSettingsEnabledFor
  try {
    const managedGroups = await async.filter(
      managedGroupSubscriptions || [],
      async subscription => {
        const managedUsersResults = await Modules.promises.hooks.fire(
          'hasManagedUsersFeature',
          subscription
        )
        const groupSSOResults = await Modules.promises.hooks.fire(
          'hasGroupSSOFeature',
          subscription
        )
        const isGroupAdmin =
          (subscription.admin_id._id || subscription.admin_id).toString() ===
          user._id.toString()
        return (
          (managedUsersResults?.[0] === true ||
            groupSSOResults?.[0] === true) &&
          isGroupAdmin
        )
      }
    )
    groupSettingsEnabledFor = managedGroups.map(subscription =>
      subscription._id.toString()
    )
  } catch (error) {
    logger.error(
      { err: error },
      'Failed to list groups with group settings enabled'
    )
  }

  let groupSettingsAdvertisedFor
  try {
    const managedGroups = await async.filter(
      managedGroupSubscriptions || [],
      async subscription => {
        const managedUsersResults = await Modules.promises.hooks.fire(
          'hasManagedUsersFeatureOnNonProfessionalPlan',
          subscription
        )
        const groupSSOResults = await Modules.promises.hooks.fire(
          'hasGroupSSOFeatureOnNonProfessionalPlan',
          subscription
        )
        const isGroupAdmin =
          (subscription.admin_id._id || subscription.admin_id).toString() ===
          user._id.toString()
        const plan = PlansLocator.findLocalPlanInSettings(subscription.planCode)
        return (
          (managedUsersResults?.[0] === true ||
            groupSSOResults?.[0] === true) &&
          isGroupAdmin &&
          flexibleLicensingVariant === 'enabled' &&
          plan?.canUseFlexibleLicensing
        )
      }
    )
    groupSettingsAdvertisedFor = managedGroups.map(subscription =>
      subscription._id.toString()
    )
  } catch (error) {
    logger.error(
      { err: error },
      'Failed to list groups with group settings enabled for advertising'
    )
  }

  const data = {
    title: 'your_subscription',
    plans: plansData?.plans,
    planCodesChangingAtTermEnd: plansData?.planCodesChangingAtTermEnd,
    user,
    hasSubscription,
    fromPlansPage,
    personalSubscription,
    userCanExtendTrial,
    memberGroupSubscriptions,
    managedGroupSubscriptions,
    managedInstitutions,
    managedPublishers,
    currentInstitutionsWithLicence,
    canUseFlexibleLicensing:
      personalSubscription?.plan?.canUseFlexibleLicensing,
    groupPlans: groupPlansDataForDash,
    groupSettingsAdvertisedFor,
    groupSettingsEnabledFor,
    isManagedAccount: !!req.managedBy,
    userRestrictions: Array.from(req.userRestrictions || []),
  }
  res.render('subscriptions/dashboard-react', data)
}

async function successfulSubscription(req, res) {
  const user = SessionManager.getSessionUser(req.session)

  const { personalSubscription } =
    await SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
      user,
      req.i18n.language
    )

  const postCheckoutRedirect = req.session?.postCheckoutRedirect

  if (!personalSubscription) {
    res.redirect('/user/subscription/plans')
  } else {
    res.render('subscriptions/successful-subscription-react', {
      title: 'thank_you',
      personalSubscription,
      postCheckoutRedirect,
      user,
    })
  }
}

async function pauseSubscription(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  const pauseCycles = req.params.pauseCycles
  if (!('pauseCycles' in req.params)) {
    return HttpErrorHandler.badRequest(
      req,
      res,
      `Pausing subscription requires a 'pauseCycles' argument with number of billing cycles to pause for`
    )
  }
  if (pauseCycles < 0) {
    return HttpErrorHandler.badRequest(
      req,
      res,
      `'pauseCycles' should be a number of billing cycles to pause for, or 0 to cancel a pending pause`
    )
  }
  logger.debug(
    { userId: user._id },
    `pausing subscription for ${pauseCycles} billing cycles`
  )
  try {
    await SubscriptionHandler.promises.pauseSubscription(user, pauseCycles)

    const { subscription } =
      await LimitationsManager.promises.userHasSubscription(user)

    AnalyticsManager.recordEventForUserInBackground(
      user._id,
      'subscription-pause-scheduled',
      {
        pause_length: pauseCycles,
        plan_code: subscription?.planCode,
        subscriptionId: subscription?.recurlySubscription_id,
      }
    )

    return res.sendStatus(200)
  } catch (err) {
    if (err instanceof Error) {
      OError.tag(err, 'something went wrong pausing subscription', {
        user_id: user._id,
      })
    }
    return next(err)
  }
}

async function resumeSubscription(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  logger.debug({ userId: user._id }, `resuming subscription`)
  try {
    await SubscriptionHandler.promises.resumeSubscription(user)
    return res.sendStatus(200)
  } catch (err) {
    if (err instanceof Error) {
      OError.tag(err, 'something went wrong resuming subscription', {
        user_id: user._id,
      })
    }
    return next(err)
  }
}

function cancelSubscription(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  logger.debug({ userId: user._id }, 'canceling subscription')
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

/**
 * @returns {Promise<void>}
 */
async function canceledSubscription(req, res, next) {
  return res.render('subscriptions/canceled-subscription-react', {
    title: 'subscription_canceled',
    user: SessionManager.getSessionUser(req.session),
  })
}

function cancelV1Subscription(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  logger.debug({ userId }, 'canceling v1 subscription')
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

async function previewAddonPurchase(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const addOnCode = req.params.addOnCode

  if (addOnCode !== AI_ADD_ON_CODE) {
    return HttpErrorHandler.notFound(req, res, `Unknown add-on: ${addOnCode}`)
  }

  const paymentMethod = await RecurlyClient.promises.getPaymentMethod(userId)

  let subscriptionChange
  try {
    subscriptionChange =
      await SubscriptionHandler.promises.previewAddonPurchase(userId, addOnCode)
  } catch (err) {
    if (err instanceof DuplicateAddOnError) {
      return HttpErrorHandler.badRequest(
        req,
        res,
        `Subscription already has add-on "${addOnCode}"`
      )
    }
    throw err
  }

  const subscription = subscriptionChange.subscription
  const addOn = await RecurlyClient.promises.getAddOn(
    subscription.planCode,
    addOnCode
  )

  /** @type {SubscriptionChangePreview} */
  const changePreview = makeChangePreview(
    {
      type: 'add-on-purchase',
      addOn: {
        code: addOn.code,
        name: addOn.name,
      },
    },
    subscriptionChange,
    paymentMethod
  )

  res.render('subscriptions/preview-change', { changePreview })
}

async function purchaseAddon(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  const addOnCode = req.params.addOnCode
  // currently we only support having a quantity of 1
  const quantity = 1
  // currently we only support one add-on, the Ai add-on
  if (addOnCode !== AI_ADD_ON_CODE) {
    return res.sendStatus(404)
  }

  logger.debug({ userId: user._id, addOnCode }, 'purchasing add-ons')
  try {
    await SubscriptionHandler.promises.purchaseAddon(
      user._id,
      addOnCode,
      quantity
    )
    return res.sendStatus(200)
  } catch (err) {
    if (err instanceof DuplicateAddOnError) {
      HttpErrorHandler.badRequest(
        req,
        res,
        'Your subscription already includes this add-on',
        { addon: addOnCode }
      )
    } else {
      if (err instanceof Error) {
        OError.tag(err, 'something went wrong purchasing add-ons', {
          user_id: user._id,
          addOnCode,
        })
      }
      return next(err)
    }
  }
}

async function removeAddon(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  const addOnCode = req.params.addOnCode

  if (addOnCode !== AI_ADD_ON_CODE) {
    return res.sendStatus(404)
  }

  logger.debug({ userId: user._id, addOnCode }, 'removing add-ons')

  try {
    await SubscriptionHandler.promises.removeAddon(user._id, addOnCode)
    res.sendStatus(200)
  } catch (err) {
    if (err instanceof AddOnNotPresentError) {
      HttpErrorHandler.badRequest(
        req,
        res,
        'Your subscription does not contain the requested add-on',
        { addon: addOnCode }
      )
    } else {
      if (err instanceof Error) {
        OError.tag(err, 'something went wrong removing add-ons', {
          user_id: user._id,
          addOnCode,
        })
      }
      return next(err)
    }
  }
}

async function previewSubscription(req, res, next) {
  const planCode = req.query.planCode
  if (!planCode) {
    return HttpErrorHandler.notFound(req, res, 'Missing plan code')
  }
  const plan = await RecurlyClient.promises.getPlan(planCode)
  const userId = SessionManager.getLoggedInUserId(req.session)
  const subscriptionChange =
    await SubscriptionHandler.promises.previewSubscriptionChange(
      userId,
      planCode
    )
  const paymentMethod = await RecurlyClient.promises.getPaymentMethod(userId)
  const changePreview = makeChangePreview(
    {
      type: 'premium-subscription',
      plan: { code: plan.code, name: plan.name },
    },
    subscriptionChange,
    paymentMethod
  )

  res.render('subscriptions/preview-change', { changePreview })
}

function updateSubscription(req, res, next) {
  const origin = req && req.query ? req.query.origin : null
  const user = SessionManager.getSessionUser(req.session)
  const planCode = req.body.plan_code
  if (planCode == null) {
    const err = new Error('plan_code is not defined')
    logger.warn(
      { userId: user._id, err, planCode, origin, body: req.body },
      '[Subscription] error in updateSubscription form'
    )
    return next(err)
  }
  logger.debug({ planCode, userId: user._id }, 'updating subscription')
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
  logger.debug({ userId: user._id }, 'canceling pending subscription change')
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
  logger.debug({ userId: user._id }, 'reactivating subscription')
  try {
    if (req.isManagedGroupAdmin) {
      // allow admins to reactivate subscriptions
    } else {
      // otherwise require the user to have the reactivate-subscription permission
      req.assertPermission('reactivate-subscription')
    }
  } catch (error) {
    return next(error)
  }
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
  logger.debug({ data: req.body }, 'received recurly callback')
  const event = Object.keys(req.body)[0]
  const eventData = req.body[event]

  RecurlyEventHandler.sendRecurlyAnalyticsEvent(event, eventData).catch(error =>
    logger.error(
      { err: error },
      'Failed to process analytics event on Recurly webhook'
    )
  )

  if (
    [
      'new_subscription_notification',
      'updated_subscription_notification',
      'expired_subscription_notification',
      'subscription_paused_notification',
      'subscription_resumed_notification',
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

async function extendTrial(req, res) {
  const user = SessionManager.getSessionUser(req.session)
  const { subscription } =
    await LimitationsManager.promises.userHasSubscription(user)

  const allowed = (
    await Modules.promises.hooks.fire('userCanExtendTrial', user)
  )?.[0]
  if (!allowed) {
    logger.warn({ userId: user._id }, 'user can not extend trial')
    return res.sendStatus(403)
  }

  try {
    await SubscriptionHandler.promises.extendTrial(subscription, 14)
    AnalyticsManager.recordEventForSession(
      req.session,
      'subscription-trial-extended'
    )
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
  await FeaturesUpdater.promises.refreshFeatures(userId, 'acceptance-test')
  res.sendStatus(200)
}

async function redirectToHostedPage(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { pageType } = req.params
  const url =
    await SubscriptionViewModelBuilder.promises.getRedirectToHostedPage(
      userId,
      pageType
    )
  logger.warn({ userId, pageType }, 'redirecting to recurly hosted page')
  res.redirect(url)
}

async function getRecommendedCurrency(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  let ip = req.ip
  if (
    req.query?.ip &&
    (await AuthorizationManager.promises.isUserSiteAdmin(userId))
  ) {
    ip = req.query.ip
  }
  const currencyLookup = await GeoIpLookup.promises.getCurrencyCode(ip)
  const countryCode = currencyLookup.countryCode
  const recommendedCurrency = currencyLookup.currencyCode

  let currency = null
  const queryCurrency = req.query.currency?.toUpperCase()
  if (queryCurrency && GeoIpLookup.isValidCurrencyParam(queryCurrency)) {
    currency = queryCurrency
  } else if (recommendedCurrency) {
    currency = recommendedCurrency
  }

  return {
    currency,
    recommendedCurrency,
    countryCode,
  }
}

async function getLatamCountryBannerDetails(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  let ip = req.ip
  if (
    req.query?.ip &&
    (await AuthorizationManager.promises.isUserSiteAdmin(userId))
  ) {
    ip = req.query.ip
  }
  const currencyLookup = await GeoIpLookup.promises.getCurrencyCode(ip)
  const countryCode = currencyLookup.countryCode
  const latamCountryBannerDetails = {}

  switch (countryCode) {
    case `MX`:
      latamCountryBannerDetails.latamCountryFlag = '🇲🇽'
      latamCountryBannerDetails.country = 'Mexico'
      latamCountryBannerDetails.discount = '25%'
      latamCountryBannerDetails.currency = 'Mexican Pesos'
      break
    case `CO`:
      latamCountryBannerDetails.latamCountryFlag = '🇨🇴'
      latamCountryBannerDetails.country = 'Colombia'
      latamCountryBannerDetails.discount = '60%'
      latamCountryBannerDetails.currency = 'Colombian Pesos'
      break
    case `CL`:
      latamCountryBannerDetails.latamCountryFlag = '🇨🇱'
      latamCountryBannerDetails.country = 'Chile'
      latamCountryBannerDetails.discount = '30%'
      latamCountryBannerDetails.currency = 'Chilean Pesos'
      break
    case `PE`:
      latamCountryBannerDetails.latamCountryFlag = '🇵🇪'
      latamCountryBannerDetails.country = 'Peru'
      latamCountryBannerDetails.currency = 'Peruvian Soles'
      latamCountryBannerDetails.discount = '40%'
      break
  }

  return latamCountryBannerDetails
}

/**
 * There are two sets of group plans: legacy plans and consolidated plans,
 * and their naming conventions differ.
 * This helper method computes the name of legacy group plans to ensure
 * consistency with the naming of consolidated group plans.
 *
 * @param {string} planName
 * @param {string} planCode
 * @return {string}
 */

function getPlanNameForDisplay(planName, planCode) {
  const match = planCode.match(
    /^group_(collaborator|professional)_\d+_(enterprise|educational)$/
  )

  if (!match) return planName

  const [, type, category] = match
  const prefix = type === 'collaborator' ? 'Standard' : 'Professional'
  const suffix = category === 'educational' ? ' Educational' : ''

  return `Overleaf ${prefix} Group${suffix}`
}

/**
 * Build a subscription change preview for display purposes
 *
 * @param {SubscriptionChangeDescription} subscriptionChangeDescription A description of the change for the frontend
 * @param {RecurlySubscriptionChange} subscriptionChange The subscription change object coming from Recurly
 * @param {PaymentMethod} paymentMethod The payment method associated to the user
 * @return {SubscriptionChangePreview}
 */
function makeChangePreview(
  subscriptionChangeDescription,
  subscriptionChange,
  paymentMethod
) {
  const subscription = subscriptionChange.subscription
  const nextPlan = PlansLocator.findLocalPlanInSettings(
    subscriptionChange.nextPlanCode
  )
  return {
    change: subscriptionChangeDescription,
    currency: subscription.currency,
    immediateCharge: { ...subscriptionChange.immediateCharge },
    paymentMethod: paymentMethod.toString(),
    nextPlan: {
      annual: nextPlan.annual ?? false,
    },
    nextInvoice: {
      date: subscription.periodEnd.toISOString(),
      plan: {
        name: getPlanNameForDisplay(
          subscriptionChange.nextPlanName,
          subscriptionChange.nextPlanCode
        ),
        amount: subscriptionChange.nextPlanPrice,
      },
      addOns: subscriptionChange.nextAddOns.map(addOn => ({
        code: addOn.code,
        name: addOn.name,
        quantity: addOn.quantity,
        unitAmount: addOn.unitPrice,
        amount: addOn.preTaxTotal,
      })),
      subtotal: subscriptionChange.subtotal,
      tax: {
        rate: subscription.taxRate,
        amount: subscriptionChange.tax,
      },
      total: subscriptionChange.total,
    },
  }
}

module.exports = {
  userSubscriptionPage: expressify(userSubscriptionPage),
  successfulSubscription: expressify(successfulSubscription),
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  canceledSubscription: expressify(canceledSubscription),
  cancelV1Subscription,
  previewSubscription: expressify(previewSubscription),
  updateSubscription,
  cancelPendingSubscriptionChange,
  updateAccountEmailAddress,
  reactivateSubscription,
  recurlyCallback,
  extendTrial: expressify(extendTrial),
  recurlyNotificationParser,
  refreshUserFeatures: expressify(refreshUserFeatures),
  redirectToHostedPage: expressify(redirectToHostedPage),
  previewAddonPurchase: expressify(previewAddonPurchase),
  purchaseAddon,
  removeAddon,
  makeChangePreview,
  getRecommendedCurrency,
  getLatamCountryBannerDetails,
  getPlanNameForDisplay,
}
