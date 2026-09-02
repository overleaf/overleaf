// @ts-check

import SessionManager from '../Authentication/SessionManager.mjs'
import SubscriptionHandler from './SubscriptionHandler.mjs'
import SubscriptionHelper from './SubscriptionHelper.mjs'
import SubscriptionViewModelBuilder from './SubscriptionViewModelBuilder.mjs'
import LimitationsManager from './LimitationsManager.mjs'
import RecurlyWrapper from './RecurlyWrapper.mjs'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import GeoIpLookup from '../../infrastructure/GeoIpLookup.mjs'
import FeaturesUpdater from './FeaturesUpdater.mjs'
import GroupPlansData from './GroupPlansData.mjs'
import V1SubscriptionManager from './V1SubscriptionManager.mjs'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'
import RecurlyEventHandler from './RecurlyEventHandler.mjs'
import { expressify } from '@overleaf/promise-utils'
import OError from '@overleaf/o-error'
import Errors from './Errors.mjs'
import SplitTestHandler from '../SplitTests/SplitTestHandler.mjs'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import Modules from '../../infrastructure/Modules.mjs'
import async from 'async'
import HttpErrorHandler from '../Errors/HttpErrorHandler.mjs'
import { AI_ADD_ON_CODE } from './AiHelper.mjs'
import PlansLocator from './PlansLocator.mjs'
import { DEFAULT_PRICE_VERSION } from './PriceVersions.mjs'
import { User } from '../../models/User.mjs'
import UserGetter from '../User/UserGetter.mjs'
import { sanitizeSessionUserForFrontEnd } from '../../infrastructure/FrontEndUser.mjs'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'
import { PaymentProviderSubscriptionChange } from './PaymentProviderEntities.mjs'

const { AddOnNotPresentError, MultiplePendingChangesError } = Errors
const { AddressPendingReactivationError } = Errors

const SUBSCRIPTION_PAUSED_REDIRECT_PATH =
  '/user/subscription?redirect-reason=subscription-paused'

/**
 * @typedef {import('../../../../types/subscription/currency').CurrencyCode} CurrencyCode
 * @typedef {import('./PaymentProviderEntities.mjs').PaymentProviderSubscription} PaymentProviderSubscription
 * @typedef {import('../../../../types/subscription/plan').Plan} Plan
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 * @typedef {import('express').NextFunction} NextFunction
 */

/**
 * Check if a Stripe subscription is currently paused
 * @param {Record<string, any>} subscription - The subscription object
 * @returns {Promise<boolean>}
 */
async function _checkStripeSubscriptionPauseStatus(subscription) {
  if (
    !subscription.paymentProvider?.service?.includes('stripe') ||
    !subscription.paymentProvider.subscriptionId
  ) {
    return false
  }

  const [paymentRecord] = await Modules.promises.hooks.fire(
    'getPaymentFromRecord',
    subscription
  )

  return !!(
    paymentRecord.subscription.remainingPauseCycles &&
    paymentRecord.subscription.remainingPauseCycles > 0
  )
}

/**
 * Check if a Recurly subscription is currently paused
 * @param {Record<string, any>} subscription - The subscription object
 * @returns {Promise<boolean>}
 */
async function _checkRecurlySubscriptionPauseStatus(subscription) {
  if (!subscription.recurlySubscription_id) {
    return false
  }

  if (subscription.recurlyStatus?.state === 'paused') {
    return true
  }

  // Get the recurly subscription as this may be a pending pause
  const recurlySubscription = await RecurlyWrapper.promises.getSubscription(
    subscription.recurlySubscription_id
  )

  return !!(
    recurlySubscription.remaining_pause_cycles &&
    recurlySubscription.remaining_pause_cycles > 0
  )
}

/**
 * Check if a user's subscription is currently paused
 * @param {Record<string, any>} user - The user object
 * @returns {Promise<{isPaused: boolean, redirectPath?: string}>}
 */
async function checkSubscriptionPauseStatus(user) {
  try {
    const { subscription } =
      await LimitationsManager.promises.userHasSubscription(user)

    if (!subscription) {
      return { isPaused: false }
    }

    const isStripePaused =
      await _checkStripeSubscriptionPauseStatus(subscription)
    if (isStripePaused) {
      return {
        isPaused: true,
        redirectPath: SUBSCRIPTION_PAUSED_REDIRECT_PATH,
      }
    }

    const isRecurlyPaused =
      await _checkRecurlySubscriptionPauseStatus(subscription)
    if (isRecurlyPaused) {
      return {
        isPaused: true,
        redirectPath: SUBSCRIPTION_PAUSED_REDIRECT_PATH,
      }
    }
  } catch (err) {
    logger.warn(
      { err, userId: user._id },
      'Failed to check user subscription for pause status'
    )
  }

  return { isPaused: false }
}

/**
 * @import { SubscriptionChangeDescription } from '../../../../types/subscription/subscription-change-preview'
 * @import { SubscriptionChangePreview } from '../../../../types/subscription/subscription-change-preview'
 * @import { PaymentMethod } from './types'
 */

const groupPlanModalOptions = Settings.groupPlanModalOptions

function formatGroupPlansDataForDash() {
  return {
    plans: [...groupPlanModalOptions.plan_codes],
    sizes: [...groupPlanModalOptions.sizes],
    usages: [...groupPlanModalOptions.usages],
    priceByUsageTypeAndSize: JSON.parse(JSON.stringify(GroupPlansData)),
  }
}

const userSubscriptionPageSchema = z.object({
  query: z.object({
    // rendered verbatim into the subscription dashboard; not consumed as a
    // real error-code enum by this handler.
    errorCode: z.string().optional(),
    // not consumed
    hasSubscription: z.stringbool().optional(),
  }),
})

/**
 * @param {Request} req
 * @param {Response} res
 */
async function userSubscriptionPage(req, res) {
  const { query } = parseReq(req, userSubscriptionPageSchema, {
    logOnly: true,
  })
  const user = SessionManager.getSessionUser(req.session)
  await SplitTestHandler.promises.getAssignment(req, res, 'sharing-updates')
  await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'sharing-updates-sharing-permissions'
  )
  await SplitTestHandler.promises.getAssignment(req, res, 'pause-subscription')
  await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'combined-user-management'
  )
  const groupPricingDiscount = await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'group-discount-10'
  )
  await SplitTestHandler.promises.getAssignment(req, res, 'ai-toggling')
  await SplitTestHandler.promises.getAssignment(req, res, 'shared-workspace')
  await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'cancel-loss-messaging'
  )

  const showGroupDiscount = groupPricingDiscount.variant === 'enabled'

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
  const redirectedPaymentErrorCode = query.errorCode
  const isInTrial = SubscriptionHelper.isInTrial(
    personalSubscription?.payment?.trialEndsAt
  )
  // The change plan modal must quote prices from the same price version that the
  // plan change itself will be charged at, except for the user's current plan, which is shown at their current price
  const priceVersion =
    (
      await Modules.promises.hooks.fire('getPriceVersionForUser', user._id)
    )?.[0] ?? DEFAULT_PRICE_VERSION
  const plansData =
    SubscriptionViewModelBuilder.buildPlansListForSubscriptionDash(
      personalSubscription?.plan,
      isInTrial,
      {
        currency: personalSubscription?.payment?.currency,
        priceVersion,
        subscriptionPlanCode: personalSubscription?.planCode,
        subscriptionPlanPrice: personalSubscription?.payment?.planPrice,
      }
    )

  const host = req.headers.host
  const domain = host?.split('.')[0]

  AnalyticsManager.recordEventForSession(
    req.session,
    'subscription-page-view',
    {
      plan_code: personalSubscription?.planCode,
      billing_cycle: PlansLocator.getPlanCadence(personalSubscription),
      is_trial: isInTrial,
      currency: personalSubscription?.payment?.currency,
      domain,
    }
  )

  const groupPlansDataForDash = formatGroupPlansDataForDash()

  // display the Group settings button only to admins of group subscriptions with either/or the Managed Users or Group SSO feature available
  let groupSettingsEnabledFor
  try {
    const managedGroups = await async.filter(
      managedGroupSubscriptions || [],
      /** @param {any} subscription */
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
    groupSettingsEnabledFor = managedGroups.map(
      (/** @type {any} */ subscription) => subscription._id.toString()
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
      async (/** @type {any} */ subscription) => {
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
          plan?.canUseFlexibleLicensing
        )
      }
    )
    groupSettingsAdvertisedFor = managedGroups.map(
      (/** @type {any} */ subscription) => subscription._id.toString()
    )
  } catch (error) {
    logger.error(
      { err: error },
      'Failed to list groups with group settings enabled for advertising'
    )
  }
  const {
    isPremium: hasAiAssistViaWritefull,
    premiumSource: aiAssistViaWritefullSource,
  } = await UserGetter.promises.getWritefullData(user._id)

  const data = {
    title: 'your_subscriptions',
    plans: plansData?.plans,
    planCodesChangingAtTermEnd: plansData?.planCodesChangingAtTermEnd,
    user,
    hasSubscription,
    redirectedPaymentErrorCode,
    personalSubscription,
    userCanExtendTrial,
    memberGroupSubscriptions,
    managedGroupSubscriptions,
    managedInstitutions,
    managedPublishers,
    showGroupDiscount,
    currentInstitutionsWithLicence,
    canUseFlexibleLicensing:
      personalSubscription?.plan?.canUseFlexibleLicensing,
    groupPlans: groupPlansDataForDash,
    groupSettingsAdvertisedFor,
    groupSettingsEnabledFor,
    isManagedAccount: !!req.managedBy,
    isManagedGroupAdmin: !!req.isManagedGroupAdmin,
    userRestrictions: Array.from(req.userRestrictions || []),
    hasAiAssistViaWritefull,
    aiAssistViaWritefullSource,
  }
  res.render('subscriptions/dashboard-react', data)
}

const successfulSubscriptionSchema = z.object({
  query: z.object({
    // only ever sent as the literal 'true', or omitted entirely -- see
    // callers in modules/subscriptions/.../root.tsx.
    upgrade: z.stringbool().optional(),
  }),
})
// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
// `query.upgrade` is compared against the literal boolean `true` below, so
// a raw passthrough still needs to produce a real boolean.
const successfulSubscriptionFallbackSchema = z.object({
  query: z.object({
    upgrade: z
      .unknown()
      .optional()
      .transform(v => v === 'true' || v === true),
  }),
})

/**
 * @param {Request} req
 * @param {Response} res
 */
async function successfulSubscription(req, res) {
  const { query } = parseReq(req, successfulSubscriptionSchema, {
    logOnly: true,
    fallbackSchema: successfulSubscriptionFallbackSchema,
  })
  const user = SessionManager.getSessionUser(req.session)
  if (!user) {
    throw new Error('User is not logged in')
  }
  const { personalSubscription } =
    await SubscriptionViewModelBuilder.promises.buildUsersSubscriptionViewModel(
      user,
      req.i18n.language
    )

  const postCheckoutRedirect = req.session?.postCheckoutRedirect
  const isUpgrade = query.upgrade === true

  if (!personalSubscription) {
    res.redirect('/user/subscription/plans')
  } else {
    const userInDb = await User.findById(user._id, {
      _id: 1,
      features: 1,
    })

    if (!userInDb) {
      throw new Error('User not found')
    }

    res.render('subscriptions/successful-subscription-react', {
      title: 'thank_you',
      personalSubscription,
      postCheckoutRedirect,
      isUpgrade,
      user: {
        _id: user._id,
        features: userInDb.features,
      },
    })
  }
}

const pauseSubscriptionSchema = z.object({
  params: z.strictObject({
    pauseCycles: z.coerce.number().int().max(12),
  }),
})

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
async function pauseSubscription(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  const { variant } = await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'pause-subscription'
  )
  if (variant !== 'enabled') {
    return HttpErrorHandler.forbidden(req, res)
  }
  const { params } = parseReq(req, pauseSubscriptionSchema)
  const pauseCycles = params.pauseCycles
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

    AnalyticsManager.recordEventForSession(
      req.session,
      'subscription-pause-scheduled',
      {
        pause_length: pauseCycles,
        plan_code: subscription?.planCode,
        subscriptionId:
          SubscriptionHelper.getPaymentProviderSubscriptionId(subscription),
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

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
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

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
async function cancelSubscription(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  logger.debug({ userId: user._id }, 'canceling subscription')
  try {
    await SubscriptionHandler.promises.cancelSubscription(user)
    return res.sendStatus(200)
  } catch (err) {
    OError.tag(err, 'something went wrong canceling subscription', {
      user_id: user._id,
    })
    return next(err)
  }
}

/**
 * @param {Request} req
 * @param {Response} res
 */
async function canceledSubscription(req, res) {
  return res.render('subscriptions/canceled-subscription-react', {
    title: 'subscription_canceled',
    user: sanitizeSessionUserForFrontEnd(
      SessionManager.getSessionUser(req.session)
    ),
  })
}

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
function cancelV1Subscription(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  logger.debug({ userId }, 'canceling v1 subscription')
  V1SubscriptionManager.cancelV1Subscription(
    userId,
    /** @param {any} err */ function (err) {
      if (err) {
        OError.tag(err, 'something went wrong canceling v1 subscription', {
          userId,
        })
        return next(err)
      }
      res.redirect('/user/subscription')
    }
  )
}

const previewAddonPurchaseSchema = z.object({
  params: z.strictObject({
    addOnCode: z.string(),
  }),
})

/**
 * @param {Request} req
 * @param {Response} res
 */
async function previewAddonPurchase(req, res) {
  const { params } = parseReq(req, previewAddonPurchaseSchema, {
    logOnly: true,
  })
  const addOnCode = params.addOnCode

  if (addOnCode !== AI_ADD_ON_CODE) {
    return HttpErrorHandler.notFound(req, res, `Unknown add-on: ${addOnCode}`)
  }

  return res.redirect(
    '/user/subscription?redirect-reason=ai-assist-unavailable'
  )
}

/**
 * @param {Request} req
 * @param {Response} res
 */
async function purchaseAddon(req, res) {
  return res.sendStatus(404)
}

const removeAddonSchema = z.object({
  params: z.strictObject({
    addOnCode: z.string(),
  }),
})

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
async function removeAddon(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  const { params } = parseReq(req, removeAddonSchema)
  const addOnCode = params.addOnCode

  if (addOnCode !== AI_ADD_ON_CODE) {
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
    } else if (err instanceof MultiplePendingChangesError) {
      logger.warn(
        { userId: user._id, err, addOnCode },
        'Cannot remove add-on: multiple pending changes'
      )
      return res.status(422).json({
        code: 'multiple_pending_changes',
        message:
          'Cannot remove add-on while there are multiple pending subscription changes. Please contact support.',
      })
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

const reactivateAddonSchema = z.object({
  params: z.strictObject({
    addOnCode: z.string(),
  }),
})

/**
 * Reactivate an add-on pending cancellation
 *
 * This "cancels" the cancellation.
 * @param {Request} req
 * @param {Response} res
 */
async function reactivateAddon(req, res) {
  const user = SessionManager.getSessionUser(req.session)
  const { params } = parseReq(req, reactivateAddonSchema)
  const addOnCode = params.addOnCode

  if (addOnCode !== AI_ADD_ON_CODE) {
    return res.sendStatus(404)
  }

  try {
    await SubscriptionHandler.promises.reactivateAddon(user._id, addOnCode)
    res.sendStatus(200)
  } catch (err) {
    if (err instanceof AddOnNotPresentError) {
      HttpErrorHandler.badRequest(
        req,
        res,
        'The requested add-on is not pending cancellation',
        { addon: addOnCode }
      )
    } else {
      throw err
    }
  }
}

const previewSubscriptionSchema = z.object({
  query: z.object({
    planCode: z.string().optional(),
    // rendered verbatim into the preview page; not consumed as a real
    // error-code enum by this handler.
    errorCode: z.string().optional(),
  }),
})

/**
 * @param {Request} req
 * @param {Response} res
 */
async function previewSubscription(req, res) {
  const { query } = parseReq(req, previewSubscriptionSchema, {
    logOnly: true,
  })
  const planCode = query.planCode
  if (!planCode) {
    return HttpErrorHandler.notFound(req, res, 'Missing plan code')
  }
  const plan = PlansLocator.findLocalPlanInSettings(planCode)
  if (!plan) {
    return HttpErrorHandler.notFound(req, res, `Unknown plan: ${planCode}`)
  }
  const user = SessionManager.getSessionUser(req.session)
  const userId = user?._id

  let trialDisabledReason
  if (planCode.includes('_free_trial')) {
    const trialEligibility = (
      await Modules.promises.hooks.fire('userCanStartTrial', user)
    )?.[0]
    if (!trialEligibility.canStartTrial) {
      trialDisabledReason = trialEligibility.disabledReason
    }
  }

  let subscriptionChange
  try {
    subscriptionChange =
      await SubscriptionHandler.promises.previewSubscriptionChange(
        userId,
        planCode
      )
  } catch (err) {
    if (
      err instanceof Error &&
      err.constructor.name === 'PaymentServiceResourceNotFoundError'
    ) {
      return res.redirect('/user/subscription/plans')
    }
    throw err
  }
  /** @type {PaymentMethod[]} */
  const paymentMethod = await Modules.promises.hooks.fire(
    'getPaymentMethod',
    userId
  )
  const changePreview = makeChangePreview(
    {
      type: 'premium-subscription',
      plan: { code: plan.planCode, name: plan.name },
    },
    subscriptionChange,
    paymentMethod[0]
  )

  res.render('subscriptions/preview-change', {
    changePreview,
    redirectedPaymentErrorCode: query.errorCode,
    trialDisabledReason,
  })
}

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
function cancelPendingSubscriptionChange(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  logger.debug({ userId: user._id }, 'canceling pending subscription change')
  SubscriptionHandler.cancelPendingSubscriptionChange(
    user,
    /** @param {any} err */ function (err) {
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
    }
  )
}

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
async function updateAccountEmailAddress(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  try {
    await Modules.promises.hooks.fire(
      'updateAccountEmailAddress',
      user._id,
      user.email
    )
    return res.sendStatus(200)
  } catch (error) {
    return next(error)
  }
}

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
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
      if (err instanceof AddressPendingReactivationError) {
        return res.status(422).json({
          code: 'address_pending',
          message:
            'Please add a valid billing address to your account before reactivating your subscription.',
        })
      }
      OError.tag(err, 'something went wrong reactivating subscription', {
        user_id: user._id,
      })
      return next(err)
    }
    res.redirect('/user/subscription')
  })
}

// Recurly's webhook body is `{ <event_name>: { ...event-specific fields } }`
// -- the event name is one of an open-ended set defined by Recurly (this
// handler only actively branches on a known subset; anything else falls
// through to the generic 200 response below), and the payload shape varies
// per event type. This is a genuinely open map, not a shape we can name
// field-by-field.
const recurlyCallbackSchema = z.object({
  body: z.record(z.string(), z.unknown()),
})

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
function recurlyCallback(req, res, next) {
  const { body } = parseReq(req, recurlyCallbackSchema, { logOnly: true })
  logger.debug({ data: body }, 'received recurly callback')
  const event = Object.keys(body)[0]
  /** @type {any} the shape varies per Recurly event type -- see the schema comment above */
  const eventData = body[event]

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

/**
 * @param {Request} req
 * @param {Response} res
 */
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

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
function recurlyNotificationParser(req, res, next) {
  let xml = ''
  req.on('data', /** @param {any} chunk */ chunk => (xml += chunk))
  req.on('end', () =>
    RecurlyWrapper._parseXml(
      xml,
      /**
       * @param {any} error
       * @param {any} body
       */
      function (error, body) {
        if (error) {
          return next(error)
        }
        req.body = body
        next()
      }
    )
  )
}

const refreshUserFeaturesSchema = z.object({
  params: z.strictObject({
    user_id: zz.objectId(),
  }),
})

/**
 * @param {Request} req
 * @param {Response} res
 */
async function refreshUserFeatures(req, res) {
  const { params } = parseReq(req, refreshUserFeaturesSchema, {
    logOnly: true,
  })
  const { user_id: userId } = params
  await FeaturesUpdater.promises.refreshFeatures(userId, 'acceptance-test')
  res.sendStatus(200)
}

// This is invoked as a shared helper from several different routes'
// handlers (PlansController, InterstitialPaymentController,
// PaymentController), not mounted as a route itself -- like middleware, it
// validates only the fields it reads, non-strictly, so it doesn't reject
// fields that belong to whichever route's own schema actually owns the
// request.
const getRecommendedCurrencySchema = z.object({
  query: z.object({
    // only trusted for site admins (checked below); an override for
    // testing/support purposes.
    ip: z.ipv4().optional(),
    currency: z.string().optional(),
  }),
})

/**
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<{currency: CurrencyCode, recommendedCurrency: CurrencyCode, countryCode: string|undefined}>}
 */
async function getRecommendedCurrency(req, res) {
  const { query } = parseReq(req, getRecommendedCurrencySchema, {
    logOnly: true,
  })
  const userId = SessionManager.getLoggedInUserId(req.session)
  let ip = req.ip
  if (
    query?.ip &&
    (await AuthorizationManager.promises.isUserSiteAdmin(userId))
  ) {
    ip = query.ip
  }
  const currencyLookup = await GeoIpLookup.promises.getCurrencyCode(ip)
  const countryCode = currencyLookup.countryCode
  const recommendedCurrency = currencyLookup.currencyCode

  let currency = null
  const queryCurrency = query.currency?.toUpperCase()
  if (queryCurrency && GeoIpLookup.isValidCurrencyParam(queryCurrency)) {
    currency = queryCurrency
  } else if (recommendedCurrency) {
    currency = recommendedCurrency
  }

  return {
    // `currency` can genuinely be null (no query override and no
    // GeoIP-recommended currency); the return type below is looser than
    // the cast.
    currency: /** @type {any} */ (currency),
    recommendedCurrency,
    countryCode,
  }
}

// Shared helper, same caveat as getRecommendedCurrency above.
const getLatamCountryBannerDetailsSchema = z.object({
  query: z.object({
    ip: z.ipv4().optional(),
  }),
})

/**
 * @param {Request} req
 * @param {Response} res
 */
async function getLatamCountryBannerDetails(req, res) {
  const { query } = parseReq(req, getLatamCountryBannerDetailsSchema, {
    logOnly: true,
  })
  const userId = SessionManager.getLoggedInUserId(req.session)
  let ip = req.ip
  if (
    query?.ip &&
    (await AuthorizationManager.promises.isUserSiteAdmin(userId))
  ) {
    ip = query.ip
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
  const prefix = type === 'collaborator' ? 'Standard' : 'Pro'
  const suffix = category === 'educational' ? ' with edu discount' : ''

  return `${prefix} group${suffix}`
}

/**
 * Compute the date displayed as the user's next invoice on the preview page.
 *
 * Default: the current cycle's end (`subscription.periodEnd`).
 *
 * Exception: when the change is applied immediately AND flips cadence
 * (monthly ↔ annual), the user starts a new term today and the next invoice
 * lands one new-term-length from now. We reuse
 * `SubscriptionHelper.shouldPlanChangeAtTermEnd` so the immediate-vs-deferred
 * decision stays in step with the apply path (including the trial case).
 *
 * @param {PaymentProviderSubscription} subscription
 * @param {Plan | null | undefined} currentPlan Plan settings for the current plan, or null/undefined when unknown.
 * @param {Plan | null | undefined} nextPlan Plan settings for the post-change plan, or null/undefined when unknown.
 * @return {Date}
 */
function _getNextInvoiceDate(subscription, currentPlan, nextPlan) {
  if (currentPlan == null || nextPlan == null) {
    return subscription.periodEnd
  }
  const isCadenceChange =
    Boolean(currentPlan.annual) !== Boolean(nextPlan.annual)
  if (!isCadenceChange) {
    return subscription.periodEnd
  }
  const isAppliedImmediately = !SubscriptionHelper.shouldPlanChangeAtTermEnd(
    currentPlan,
    nextPlan,
    SubscriptionHelper.isInTrial(subscription.trialPeriodEnd)
  )
  if (!isAppliedImmediately) {
    return subscription.periodEnd
  }
  const nextInvoiceDate = new Date()
  if (nextPlan.annual) {
    nextInvoiceDate.setFullYear(nextInvoiceDate.getFullYear() + 1)
  } else {
    nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + 1)
  }
  return nextInvoiceDate
}

/**
 * Build a subscription change preview for display purposes
 *
 * @param {SubscriptionChangeDescription} subscriptionChangeDescription A description of the change for the frontend
 * @param {PaymentProviderSubscriptionChange} subscriptionChange The subscription change object coming from Recurly
 * @param {PaymentMethod} [paymentMethod] The payment method associated to the user
 * @return {SubscriptionChangePreview}
 */
function makeChangePreview(
  subscriptionChangeDescription,
  subscriptionChange,
  paymentMethod
) {
  const subscription = subscriptionChange.subscription

  // For the future invoice display, if there's a pending change scheduled,
  // we should show what will happen at renewal (the pending change state)
  // merged with any new changes from this immediate update
  const pendingChange = subscription.pendingChange

  let futureInvoiceChange
  if (pendingChange) {
    const pendingAddOnCodes = new Set(pendingChange.nextAddOns.map(a => a.code))
    const mergedAddOns = [...pendingChange.nextAddOns]

    for (const addOn of subscriptionChange.nextAddOns) {
      if (!pendingAddOnCodes.has(addOn.code)) {
        mergedAddOns.push(addOn)
      }
    }

    // If the current change is a plan change, it overrides the pending scheduled
    // plan change — use the new plan for future payments, not the stale pending one.
    const isPlanChange =
      subscriptionChangeDescription.type === 'premium-subscription' ||
      subscriptionChangeDescription.type === 'group-plan-upgrade'

    futureInvoiceChange = new PaymentProviderSubscriptionChange({
      subscription,
      nextPlanCode: isPlanChange
        ? subscriptionChange.nextPlanCode
        : pendingChange.nextPlanCode,
      nextPlanName: isPlanChange
        ? subscriptionChange.nextPlanName
        : pendingChange.nextPlanName,
      nextPlanPrice: isPlanChange
        ? subscriptionChange.nextPlanPrice
        : pendingChange.nextPlanPrice,
      nextAddOns: mergedAddOns,
    })
  } else {
    futureInvoiceChange = subscriptionChange
  }

  const nextPlan = PlansLocator.findLocalPlanInSettings(
    futureInvoiceChange.nextPlanCode
  )
  const currentPlan = PlansLocator.findLocalPlanInSettings(
    subscription.planCode
  )
  const nextInvoiceDate = _getNextInvoiceDate(
    subscription,
    currentPlan,
    nextPlan
  )

  return {
    change: subscriptionChangeDescription,
    currency: subscription.currency,
    immediateCharge: { ...subscriptionChange.immediateCharge },
    paymentMethod: paymentMethod?.toString(),
    netTerms: subscription.netTerms,
    nextPlan: {
      annual: nextPlan?.annual ?? false,
    },
    nextInvoice: {
      date: nextInvoiceDate.toISOString(),
      plan: {
        name: getPlanNameForDisplay(
          nextPlan?.name ?? futureInvoiceChange.nextPlanName,
          futureInvoiceChange.nextPlanCode
        ),
        amount: futureInvoiceChange.nextPlanPrice,
      },
      addOns: futureInvoiceChange.nextAddOns.map(addOn => ({
        code: addOn.code,
        name: addOn.name,
        quantity: addOn.quantity,
        unitAmount: addOn.unitPrice,
        amount: addOn.preTaxTotal,
      })),
      subtotal: futureInvoiceChange.subtotal,
      tax: {
        rate: subscription.taxRate,
        amount: futureInvoiceChange.tax,
      },
      total: futureInvoiceChange.total,
    },
  }
}

export default {
  userSubscriptionPage: expressify(userSubscriptionPage),
  successfulSubscription: expressify(successfulSubscription),
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  canceledSubscription: expressify(canceledSubscription),
  cancelV1Subscription,
  previewSubscription: expressify(previewSubscription),
  cancelPendingSubscriptionChange,
  updateAccountEmailAddress: expressify(updateAccountEmailAddress),
  reactivateSubscription,
  recurlyCallback,
  extendTrial: expressify(extendTrial),
  recurlyNotificationParser,
  refreshUserFeatures: expressify(refreshUserFeatures),
  previewAddonPurchase: expressify(previewAddonPurchase),
  purchaseAddon,
  removeAddon,
  reactivateAddon,
  makeChangePreview,
  getRecommendedCurrency,
  getLatamCountryBannerDetails,
  getPlanNameForDisplay,
  checkSubscriptionPauseStatus,
}
