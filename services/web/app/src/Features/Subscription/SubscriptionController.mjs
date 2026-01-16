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
import RecurlyClient from './RecurlyClient.mjs'
import {
  AI_ADD_ON_CODE,
  subscriptionChangeIsAiAssistUpgrade,
} from './AiHelper.mjs'
import PlansLocator from './PlansLocator.mjs'
import { User } from '../../models/User.mjs'
import UserGetter from '../User/UserGetter.mjs'
import PermissionsManager from '../Authorization/PermissionsManager.mjs'
import { sanitizeSessionUserForFrontEnd } from '../../infrastructure/FrontEndUser.mjs'
import { z, parseReq } from '../../infrastructure/Validation.mjs'
import { IndeterminateInvoiceError } from '../Errors/Errors.js'
import SubscriptionLocator from './SubscriptionLocator.mjs'

const {
  DuplicateAddOnError,
  AddOnNotPresentError,
  PaymentActionRequiredError,
  PaymentFailedError,
  MissingBillingInfoError,
} = Errors

const SUBSCRIPTION_PAUSED_REDIRECT_PATH =
  '/user/subscription?redirect-reason=subscription-paused'

/**
 * Check if a Stripe subscription is currently paused
 * @param {Object} subscription - The subscription object
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
 * @param {Object} subscription - The subscription object
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

/** Check if a user's subscription is manual or custom
 * @param {Object} user - The user object
 * @returns {Promise<boolean>}
 */
async function _isManualOrCustomSubscription(user) {
  const subscription = await SubscriptionLocator.promises.getUsersSubscription(
    user._id
  )
  if (!subscription) {
    return false
  }

  return (
    subscription.customAccount || subscription.collectionMethod === 'manual'
  )
}

/**
 * Check if a user's subscription is currently paused
 * @param {Object} user - The user object
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
 * @import { PaymentProviderSubscriptionChange } from './PaymentProviderEntities.mjs'
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

async function userSubscriptionPage(req, res) {
  const user = SessionManager.getSessionUser(req.session)
  await SplitTestHandler.promises.getAssignment(req, res, 'pause-subscription')

  const groupPricingDiscount = await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'group-discount-10'
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
  const fromPlansPage = req.query.hasSubscription
  const redirectedPaymentErrorCode = req.query.errorCode
  const isInTrial = SubscriptionHelper.isInTrial(
    personalSubscription?.payment?.trialEndsAt
  )
  const plansData =
    SubscriptionViewModelBuilder.buildPlansListForSubscriptionDash(
      personalSubscription?.plan,
      isInTrial
    )

  const host = req.headers.host
  const domain = host?.split('.')[0]

  AnalyticsManager.recordEventForSession(
    req.session,
    'subscription-page-view',
    {
      domain,
    }
  )

  const groupPlansDataForDash = formatGroupPlansDataForDash()

  // display the Group settings button only to admins of group subscriptions with either/or the Managed Users or Group SSO feature available
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
    fromPlansPage,
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
    userRestrictions: Array.from(req.userRestrictions || []),
    hasAiAssistViaWritefull,
    aiAssistViaWritefullSource,
  }
  res.render('subscriptions/dashboard-react', data)
}

async function successfulSubscription(req, res) {
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
      user: {
        _id: user._id,
        features: userInDb.features,
      },
    })
  }
}

const pauseSubscriptionSchema = z.object({
  params: z.object({
    pauseCycles: z.coerce.number().int().max(12),
  }),
})

async function pauseSubscription(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
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

    AnalyticsManager.recordEventForUserInBackground(
      user._id,
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
 * @returns {Promise<void>}
 */
async function canceledSubscription(req, res, next) {
  return res.render('subscriptions/canceled-subscription-react', {
    title: 'subscription_canceled',
    user: sanitizeSessionUserForFrontEnd(
      SessionManager.getSessionUser(req.session)
    ),
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
  const user = SessionManager.getSessionUser(req.session)
  const userId = user._id
  const addOnCode = req.params.addOnCode
  const purchaseReferrer = req.query.purchaseReferrer
  const redirectedPaymentErrorCode = req.query.errorCode

  if (addOnCode !== AI_ADD_ON_CODE) {
    return HttpErrorHandler.notFound(req, res, `Unknown add-on: ${addOnCode}`)
  }

  const canUseAi = await PermissionsManager.promises.checkUserPermissions(
    user,
    ['use-ai']
  )
  if (!canUseAi) {
    return res.redirect(
      '/user/subscription?redirect-reason=ai-assist-unavailable'
    )
  }

  const isManualOrCustom = await _isManualOrCustomSubscription(user)
  if (isManualOrCustom) {
    return res.redirect(
      '/user/subscription?redirect-reason=ai-assist-unavailable'
    )
  }

  const { isPaused, redirectPath } = await checkSubscriptionPauseStatus(user)
  if (isPaused) {
    return res.redirect(redirectPath)
  }

  let paymentMethod
  try {
    /** @type {PaymentMethod[]} */
    paymentMethod = await Modules.promises.hooks.fire(
      'getPaymentMethod',
      userId
    )
  } catch (err) {
    if (err instanceof MissingBillingInfoError) {
      // We will get MissingBillingInfoError if a manual subscription doesn't have billing info
      // but doesn't marked as manual on the Overleaf side
      logger.error(
        { err },
        'User has no billing info, cannot preview add-on purchase'
      )
      return res.redirect(
        '/user/subscription?redirect-reason=ai-assist-unavailable'
      )
    }
    if (
      err instanceof Error &&
      err.constructor.name === 'PaymentServiceResourceNotFoundError'
    ) {
      return res.redirect('/user/subscription/plans#ai-assist')
    }
    throw err
  }

  let subscriptionChange
  try {
    subscriptionChange =
      await SubscriptionHandler.promises.previewAddonPurchase(userId, addOnCode)

    const { isPremium: hasAiAssistViaWritefull } =
      await UserGetter.promises.getWritefullData(userId)
    const isAiUpgrade = subscriptionChangeIsAiAssistUpgrade(subscriptionChange)
    if (hasAiAssistViaWritefull && isAiUpgrade) {
      return res.redirect(
        '/user/subscription?redirect-reason=writefull-entitled'
      )
    }
  } catch (err) {
    if (err instanceof DuplicateAddOnError) {
      return res.redirect('/user/subscription?redirect-reason=double-buy')
    }
    if (
      err instanceof Error &&
      err.constructor.name === 'PaymentServiceResourceNotFoundError'
    ) {
      return res.redirect('/user/subscription/plans#ai-assist')
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
    paymentMethod[0]
  )

  await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'overleaf-assist-bundle'
  )

  res.render('subscriptions/preview-change', {
    changePreview,
    purchaseReferrer,
    redirectedPaymentErrorCode,
  })
}

const purchaseAddonSchema = z.object({
  params: z.object({
    addOnCode: z.string(),
  }),
})

async function purchaseAddon(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  const { params } = parseReq(req, purchaseAddonSchema)
  const addOnCode = params.addOnCode
  // currently we only support having a quantity of 1
  const quantity = 1
  // currently we only support one add-on, the Ai add-on
  if (addOnCode !== AI_ADD_ON_CODE) {
    return res.sendStatus(404)
  }

  const { isPaused } = await checkSubscriptionPauseStatus(user)
  if (isPaused) {
    return HttpErrorHandler.badRequest(
      req,
      res,
      'Cannot purchase add-ons while subscription is paused.'
    )
  }

  logger.debug({ userId: user._id, addOnCode }, 'purchasing add-ons')
  try {
    await SubscriptionHandler.promises.purchaseAddon(
      user._id,
      addOnCode,
      quantity
    )
  } catch (err) {
    if (err instanceof DuplicateAddOnError) {
      HttpErrorHandler.badRequest(
        req,
        res,
        'Your subscription already includes this add-on',
        { addon: addOnCode }
      )
    } else if (err instanceof PaymentActionRequiredError) {
      logger.debug(
        { userId: user._id },
        'Customer needs to perform payment action to complete transaction'
      )
      return res.status(402).json({
        message: 'Payment action required',
        clientSecret: err.info.clientSecret,
        publicKey: err.info.publicKey,
      })
    } else if (err instanceof PaymentFailedError) {
      logger.debug(
        {
          userId: user._id,
          reason: err.info.reason,
          adviceCode: err.info.adviceCode,
        },
        'Payment failed for transaction'
      )
      return res.status(402).json({
        message: 'Payment failed',
        reason: err.info.reason,
        adviceCode: err.info.adviceCode,
      })
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

  try {
    await FeaturesUpdater.promises.refreshFeatures(user._id, 'add-on-purchase')
  } catch (err) {
    logger.error({ err }, 'Failed to refresh features after add-on purchase')
  }

  return res.sendStatus(200)
}

const removeAddonSchema = z.object({
  params: z.object({
    addOnCode: z.string(),
  }),
})

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
  params: z.object({
    addOnCode: z.string(),
  }),
})

/**
 * Reactivate an add-on pending cancellation
 *
 * This "cancels" the cancellation.
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

async function previewSubscription(req, res, next) {
  const planCode = req.query.planCode
  if (!planCode) {
    return HttpErrorHandler.notFound(req, res, 'Missing plan code')
  }
  // TODO: use PaymentService to fetch plan information
  const plan = await RecurlyClient.promises.getPlan(planCode)
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

  const subscriptionChange =
    await SubscriptionHandler.promises.previewSubscriptionChange(
      userId,
      planCode
    )
  /** @type {PaymentMethod[]} */
  const paymentMethod = await Modules.promises.hooks.fire(
    'getPaymentMethod',
    userId
  )
  const changePreview = makeChangePreview(
    {
      type: 'premium-subscription',
      plan: { code: plan.code, name: plan.name },
    },
    subscriptionChange,
    paymentMethod[0]
  )

  res.render('subscriptions/preview-change', {
    changePreview,
    redirectedPaymentErrorCode: req.query.errorCode,
    trialDisabledReason,
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

  // this is a recurly only case which is required since Recurly does not have a reliable way to check credit info pre-upgrade purchase
  if (event === 'failed_payment_notification') {
    if (!Settings.planReverts?.enabled) {
      return res.sendStatus(200)
    }

    // A manual charge may have no subscription, in which case we get a
    // <subscription_id nil="true"/> element, which produces an object instead
    // of a string subscription_id.
    const subscriptionId = eventData.transaction?.subscription_id
    if (!subscriptionId || typeof subscriptionId !== 'string') {
      logger.info(
        { transactionId: eventData.transaction?.id },
        'ignoring failed_payment_notification without subscription_id'
      )
      return res.sendStatus(200)
    }

    SubscriptionHandler.getSubscriptionRestorePoint(
      subscriptionId,
      function (err, lastSubscription) {
        if (err) {
          return next(err)
        }
        // if theres no restore point it could be a failed renewal, or no restore set. Either way it will be handled through dunning automatically
        if (!lastSubscription || !lastSubscription?.planCode) {
          return res.sendStatus(200)
        }
        SubscriptionHandler.revertPlanChange(
          eventData.transaction.subscription_id,
          lastSubscription,
          function (err) {
            if (err instanceof IndeterminateInvoiceError) {
              logger.warn(
                { recurlySubscriptionId: err.info.recurlySubscriptionId },
                'could not determine invoice to fail for subscription'
              )
              return res.sendStatus(200)
            }
            if (err) {
              return next(err)
            }
            return res.sendStatus(200)
          }
        )
      }
    )
  } else if (
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
  const nextPlan = PlansLocator.findLocalPlanInSettings(
    subscriptionChange.nextPlanCode
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
