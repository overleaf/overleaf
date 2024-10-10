const SessionManager = require('../Authentication/SessionManager')
const SubscriptionHandler = require('./SubscriptionHandler')
const SubscriptionViewModelBuilder = require('./SubscriptionViewModelBuilder')
const LimitationsManager = require('./LimitationsManager')
const RecurlyWrapper = require('./RecurlyWrapper')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const GeoIpLookup = require('../../infrastructure/GeoIpLookup')
const FeaturesUpdater = require('./FeaturesUpdater')
const plansConfig = require('./plansConfig')
const interstitialPaymentConfig = require('./interstitialPaymentConfig')
const GroupPlansData = require('./GroupPlansData')
const V1SubscriptionManager = require('./V1SubscriptionManager')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const RecurlyEventHandler = require('./RecurlyEventHandler')
const { expressify } = require('@overleaf/promise-utils')
const OError = require('@overleaf/o-error')
const { DuplicateAddOnError, AddOnNotPresentError } = require('./Errors')
const SplitTestHandler = require('../SplitTests/SplitTestHandler')
const SubscriptionHelper = require('./SubscriptionHelper')
const AuthorizationManager = require('../Authorization/AuthorizationManager')
const Modules = require('../../infrastructure/Modules')
const async = require('async')
const { formatCurrencyLocalized } = require('../../util/currency')
const SubscriptionFormatters = require('./SubscriptionFormatters')
const HttpErrorHandler = require('../Errors/HttpErrorHandler')
const { URLSearchParams } = require('url')

const AI_ADDON_CODE = 'assistant'

const groupPlanModalOptions = Settings.groupPlanModalOptions
const validGroupPlanModalOptions = {
  plan_code: groupPlanModalOptions.plan_codes.map(item => item.code),
  currency: groupPlanModalOptions.currencies.map(item => item.code),
  size: groupPlanModalOptions.sizes,
  usage: groupPlanModalOptions.usages.map(item => item.code),
}

function _getGroupPlanModalDefaults(req, currency) {
  function getDefault(param, category, defaultValue) {
    const v = req.query && req.query[param]
    if (v && validGroupPlanModalOptions[category].includes(v)) {
      return v
    }
    return defaultValue
  }

  let defaultGroupPlanModalCurrency = 'USD'
  if (validGroupPlanModalOptions.currency.includes(currency)) {
    defaultGroupPlanModalCurrency = currency
  }

  return {
    plan_code: getDefault('plan', 'plan_code', 'collaborator'),
    size: getDefault('number', 'size', '2'),
    currency: getDefault('currency', 'currency', defaultGroupPlanModalCurrency),
    usage: getDefault('usage', 'usage', 'enterprise'),
  }
}

function _plansBanners({ geoPricingLATAMTestVariant, countryCode }) {
  const showLATAMBanner =
    geoPricingLATAMTestVariant === 'latam' &&
    ['MX', 'CO', 'CL', 'PE'].includes(countryCode)
  const showInrGeoBanner = countryCode === 'IN'
  const showBrlGeoBanner = countryCode === 'BR'
  return { showLATAMBanner, showInrGeoBanner, showBrlGeoBanner }
}

async function plansPage(req, res) {
  const websiteRedesignPlansAssignment =
    await SplitTestHandler.promises.getAssignment(
      req,
      res,
      'website-redesign-plans'
    )
  if (websiteRedesignPlansAssignment.variant !== 'default') {
    const queryParamString = new URLSearchParams(req.query)?.toString()
    const queryParamForRedirect = queryParamString ? '?' + queryParamString : ''

    if (websiteRedesignPlansAssignment.variant === 'new-design') {
      return res.redirect(
        302,
        '/user/subscription/plans-2' + queryParamForRedirect
      )
    } else if (websiteRedesignPlansAssignment.variant === 'light-design') {
      return res.redirect(
        302,
        '/user/subscription/plans-3' + queryParamForRedirect
      )
    }
  }

  const language = req.i18n.language || 'en'

  const plans = SubscriptionViewModelBuilder.buildPlansList()

  const { currency, countryCode, geoPricingLATAMTestVariant } =
    await _getRecommendedCurrency(req, res)

  const latamCountryBannerDetails = await getLatamCountryBannerDetails(req, res)
  const groupPlanModalDefaults = _getGroupPlanModalDefaults(req, currency)

  const currentView = 'annual'

  const { showLATAMBanner, showInrGeoBanner, showBrlGeoBanner } = _plansBanners(
    {
      geoPricingLATAMTestVariant,
      countryCode,
    }
  )

  const localCcyAssignment = await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'local-ccy-format-v2'
  )
  const formatCurrency =
    localCcyAssignment.variant === 'enabled'
      ? formatCurrencyLocalized
      : SubscriptionHelper.formatCurrencyDefault

  res.render('subscriptions/plans', {
    title: 'plans_and_pricing',
    currentView,
    plans,
    itm_content: req.query?.itm_content,
    itm_referrer: req.query?.itm_referrer,
    itm_campaign: 'plans',
    language,
    formatCurrency,
    recommendedCurrency: currency,
    plansConfig,
    groupPlans: GroupPlansData,
    groupPlanModalOptions,
    groupPlanModalDefaults,
    initialLocalizedGroupPrice:
      SubscriptionHelper.generateInitialLocalizedGroupPrice(
        currency ?? 'USD',
        language,
        formatCurrency
      ),
    showInrGeoBanner,
    showBrlGeoBanner,
    showLATAMBanner,
    latamCountryBannerDetails,
    countryCode,
    websiteRedesignPlansVariant: 'default',
  })
}

async function plansPageLightDesign(req, res) {
  const splitTestActive = await SplitTestHandler.promises.isSplitTestActive(
    'website-redesign-plans'
  )

  if (!splitTestActive && req.query.preview !== 'true') {
    return res.redirect(302, '/user/subscription/plans')
  }
  const { currency, countryCode, geoPricingLATAMTestVariant } =
    await _getRecommendedCurrency(req, res)

  const language = req.i18n.language || 'en'
  const currentView = 'annual'
  const plans = SubscriptionViewModelBuilder.buildPlansList()
  const groupPlanModalDefaults = _getGroupPlanModalDefaults(req, currency)

  const localCcyAssignment = await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'local-ccy-format-v2'
  )
  const formatCurrency =
    localCcyAssignment.variant === 'enabled'
      ? formatCurrencyLocalized
      : SubscriptionHelper.formatCurrencyDefault

  const { showLATAMBanner, showInrGeoBanner, showBrlGeoBanner } = _plansBanners(
    {
      geoPricingLATAMTestVariant,
      countryCode,
    }
  )

  const latamCountryBannerDetails = await getLatamCountryBannerDetails(req, res)

  res.render('subscriptions/plans-light-design', {
    title: 'plans_and_pricing',
    currentView,
    plans,
    itm_content: req.query?.itm_content,
    itm_referrer: req.query?.itm_referrer,
    itm_campaign: 'plans',
    language,
    formatCurrency,
    recommendedCurrency: currency,
    plansConfig,
    groupPlans: GroupPlansData,
    groupPlanModalOptions,
    groupPlanModalDefaults,
    initialLocalizedGroupPrice:
      SubscriptionHelper.generateInitialLocalizedGroupPrice(
        currency ?? 'USD',
        language,
        formatCurrency
      ),
    showLATAMBanner,
    showInrGeoBanner,
    showBrlGeoBanner,
    latamCountryBannerDetails,
    countryCode,
    websiteRedesignPlansVariant: 'light-design',
  })
}

function formatGroupPlansDataForDash() {
  return {
    plans: [...groupPlanModalOptions.plan_codes],
    sizes: [...groupPlanModalOptions.sizes],
    usages: [...groupPlanModalOptions.usages],
    priceByUsageTypeAndSize: JSON.parse(JSON.stringify(GroupPlansData)),
  }
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function userSubscriptionPage(req, res) {
  const user = SessionManager.getSessionUser(req.session)

  const localCcyAssignment = await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'local-ccy-format-v2'
  )
  await SplitTestHandler.promises.getAssignment(req, res, 'ai-add-on')

  // Populates splitTestVariants with a value for the split test name and allows
  // Pug to read it
  await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'bootstrap-5-subscription'
  )

  const results =
    await SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
      user,
      req.i18n.language,
      localCcyAssignment.variant === 'enabled'
        ? SubscriptionFormatters.formatPriceLocalized
        : SubscriptionFormatters.formatPriceDefault
    )
  const {
    personalSubscription,
    memberGroupSubscriptions,
    managedGroupSubscriptions,
    currentInstitutionsWithLicence,
    managedInstitutions,
    managedPublishers,
  } = results
  const hasSubscription =
    await LimitationsManager.promises.userHasV1OrV2Subscription(user)

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
    groupPlans: groupPlansDataForDash,
    groupSettingsEnabledFor,
    isManagedAccount: !!req.managedBy,
    userRestrictions: Array.from(req.userRestrictions || []),
  }
  res.render('subscriptions/dashboard-react', data)
}

async function interstitialPaymentPage(req, res) {
  const websiteRedesignPlansAssignment =
    await SplitTestHandler.promises.getAssignment(
      req,
      res,
      'website-redesign-plans'
    )

  let template = 'subscriptions/interstitial-payment'

  if (websiteRedesignPlansAssignment.variant === 'new-design') {
    return await Modules.promises.hooks.fire(
      'interstitialPaymentPageNewDesign',
      req,
      res
    )
  } else if (websiteRedesignPlansAssignment.variant === 'light-design') {
    template = 'subscriptions/interstitial-payment-light-design'
  }

  const user = SessionManager.getSessionUser(req.session)
  const { recommendedCurrency, countryCode, geoPricingLATAMTestVariant } =
    await _getRecommendedCurrency(req, res)

  const latamCountryBannerDetails = await getLatamCountryBannerDetails(req, res)

  const hasSubscription =
    await LimitationsManager.promises.userHasV1OrV2Subscription(user)
  const showSkipLink = req.query?.skipLink === 'true'

  if (hasSubscription) {
    res.redirect('/user/subscription?hasSubscription=true')
  } else {
    const { showLATAMBanner, showInrGeoBanner, showBrlGeoBanner } =
      _plansBanners({
        geoPricingLATAMTestVariant,
        countryCode,
      })

    const localCcyAssignment = await SplitTestHandler.promises.getAssignment(
      req,
      res,
      'local-ccy-format-v2'
    )

    res.render(template, {
      title: 'subscribe',
      itm_content: req.query?.itm_content,
      itm_campaign: req.query?.itm_campaign,
      itm_referrer: req.query?.itm_referrer,
      recommendedCurrency,
      interstitialPaymentConfig,
      showSkipLink,
      formatCurrency:
        localCcyAssignment.variant === 'enabled'
          ? formatCurrencyLocalized
          : SubscriptionHelper.formatCurrencyDefault,
      showCurrencyAndPaymentMethods: localCcyAssignment.variant === 'enabled',
      showInrGeoBanner,
      showBrlGeoBanner,
      showLATAMBanner,
      latamCountryBannerDetails,
      skipLinkTarget: req.session?.postCheckoutRedirect || '/project',
      websiteRedesignPlansVariant: websiteRedesignPlansAssignment.variant,
    })
  }
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function successfulSubscription(req, res) {
  const user = SessionManager.getSessionUser(req.session)
  const localCcyAssignment = await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'local-ccy-format-v2'
  )
  const { personalSubscription } =
    await SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
      user,
      req.i18n.language,
      localCcyAssignment.variant === 'enabled'
        ? SubscriptionFormatters.formatPriceLocalized
        : SubscriptionFormatters.formatPriceDefault
    )

  const postCheckoutRedirect = req.session?.postCheckoutRedirect

  if (!personalSubscription) {
    res.redirect('/user/subscription/plans')
  } else {
    await SplitTestHandler.promises.getAssignment(
      req,
      res,
      'bootstrap-5-subscription'
    )

    res.render('subscriptions/successful-subscription-react', {
      title: 'thank_you',
      personalSubscription,
      postCheckoutRedirect,
    })
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
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
async function canceledSubscription(req, res, next) {
  await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'bootstrap-5-subscription'
  )
  return res.render('subscriptions/canceled-subscription-react', {
    title: 'subscription_canceled',
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

async function purchaseAddon(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  const addOnCode = req.params.addOnCode
  // currently we only support having a quantity of 1
  const quantity = 1
  // currently we only support one add-on, the Ai add-on
  if (addOnCode !== AI_ADDON_CODE) {
    return res.sendStatus(404)
  }

  logger.debug({ userId: user._id, addOnCode }, 'purchasing add-ons')
  try {
    await SubscriptionHandler.promises.purchaseAddon(user, addOnCode, quantity)
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
      OError.tag(err, 'something went wrong purchasing add-ons', {
        user_id: user._id,
        addOnCode,
      })
      return next(err)
    }
  }
}

async function removeAddon(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  const addOnCode = req.params.addOnCode

  if (addOnCode !== AI_ADDON_CODE) {
    return res.sendStatus(404)
  }

  logger.debug({ userId: user._id, addOnCode }, 'removing add-ons')

  try {
    await SubscriptionHandler.promises.removeAddon(user, addOnCode)
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
      OError.tag(err, 'something went wrong removing add-ons', {
        user_id: user._id,
        addOnCode,
      })
      return next(err)
    }
  }
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
    await LimitationsManager.promises.userHasV2Subscription(user)

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

async function _getRecommendedCurrency(req, res) {
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
  let recommendedCurrency = currencyLookup.currencyCode

  const assignmentLATAM = await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'geo-pricing-latam-v2'
  )

  if (
    ['MXN', 'COP', 'CLP', 'PEN'].includes(recommendedCurrency) &&
    assignmentLATAM?.variant === 'default'
  ) {
    recommendedCurrency = GeoIpLookup.DEFAULT_CURRENCY_CODE
  }

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
    geoPricingLATAMTestVariant: assignmentLATAM?.variant,
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

module.exports = {
  plansPage: expressify(plansPage),
  plansPageLightDesign: expressify(plansPageLightDesign),
  userSubscriptionPage: expressify(userSubscriptionPage),
  interstitialPaymentPage: expressify(interstitialPaymentPage),
  successfulSubscription: expressify(successfulSubscription),
  cancelSubscription,
  canceledSubscription: expressify(canceledSubscription),
  cancelV1Subscription,
  updateSubscription,
  cancelPendingSubscriptionChange,
  updateAccountEmailAddress,
  reactivateSubscription,
  recurlyCallback,
  extendTrial: expressify(extendTrial),
  recurlyNotificationParser,
  refreshUserFeatures: expressify(refreshUserFeatures),
  redirectToHostedPage: expressify(redirectToHostedPage),
  plansBanners: _plansBanners,
  purchaseAddon,
  removeAddon,
  promises: {
    getRecommendedCurrency: _getRecommendedCurrency,
    getLatamCountryBannerDetails,
  },
}
