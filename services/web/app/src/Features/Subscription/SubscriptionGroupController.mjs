import SubscriptionGroupHandler from './SubscriptionGroupHandler.mjs'

import OError from '@overleaf/o-error'
import logger from '@overleaf/logger'
import SubscriptionLocator from './SubscriptionLocator.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import UserAuditLogHandler from '../User/UserAuditLogHandler.mjs'
import { expressify } from '@overleaf/promise-utils'
import Modules from '../../infrastructure/Modules.mjs'
import UserGetter from '../User/UserGetter.mjs'
import { Subscription } from '../../models/Subscription.mjs'
import { z, parseReq } from '../../infrastructure/Validation.mjs'
import { isProfessionalGroupPlan } from './PlansHelper.mjs'
import {
  MissingBillingInfoError,
  ManuallyCollectedError,
  PendingChangeError,
  InactiveError,
  SubtotalLimitExceededError,
  HasPastDueInvoiceError,
  HasNoAdditionalLicenseWhenManuallyCollectedError,
  PaymentActionRequiredError,
} from './Errors.mjs'

const MAX_NUMBER_OF_USERS = 20
const MAX_NUMBER_OF_PO_NUMBER_CHARACTERS = 50

/**
 * @import { Subscription } from "../../../../types/subscription/dashboard/subscription.js"
 */

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
async function removeUserFromGroup(req, res) {
  const subscription = req.entity
  const userToRemoveId = req.params.user_id
  const loggedInUserId = SessionManager.getLoggedInUserId(req.session)
  const subscriptionId = subscription._id
  logger.debug(
    { subscriptionId, userToRemoveId },
    'removing user from group subscription'
  )

  await _removeUserFromGroup(req, res, {
    userToRemoveId,
    loggedInUserId,
    subscription,
  })
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
async function removeSelfFromGroup(req, res) {
  const userToRemoveId = SessionManager.getLoggedInUserId(req.session)
  const subscription = await SubscriptionLocator.promises.getSubscription(
    req.query.subscriptionId
  )

  await _removeUserFromGroup(req, res, {
    userToRemoveId,
    loggedInUserId: userToRemoveId,
    subscription,
  })
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {string} userToRemoveId
 * @param {string} loggedInUserId
 * @param {Subscription} subscription
 * @returns {Promise<void>}
 * @private
 */
async function _removeUserFromGroup(
  req,
  res,
  { userToRemoveId, loggedInUserId, subscription }
) {
  const subscriptionId = subscription._id

  const groupSSOActive = (
    await Modules.promises.hooks.fire('hasGroupSSOEnabled', subscription)
  )?.[0]
  if (groupSSOActive) {
    await Modules.promises.hooks.fire(
      'unlinkUserFromGroupSSO',
      userToRemoveId,
      subscriptionId
    )
  }

  try {
    await UserAuditLogHandler.promises.addEntry(
      userToRemoveId,
      'remove-from-group-subscription',
      loggedInUserId,
      req.ip,
      { subscriptionId }
    )
  } catch (auditLogError) {
    throw OError.tag(auditLogError, 'error adding audit log entry', {
      userToRemoveId,
      subscriptionId,
    })
  }

  const groupAuditLog = {
    initiatorId: loggedInUserId,
    ipAddress: req.ip,
  }

  try {
    await SubscriptionGroupHandler.promises.removeUserFromGroup(
      subscriptionId,
      userToRemoveId,
      groupAuditLog
    )
  } catch (error) {
    logger.err(
      { err: error, userToRemoveId, subscriptionId },
      'error removing self from group'
    )
    return res.sendStatus(500)
  }

  res.sendStatus(200)
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
async function addSeatsToGroupSubscription(req, res) {
  try {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const { subscription, paymentProviderSubscription, plan } =
      await SubscriptionGroupHandler.promises.getUsersGroupSubscriptionDetails(
        userId
      )
    await SubscriptionGroupHandler.promises.ensureFlexibleLicensingEnabled(plan)
    await SubscriptionGroupHandler.promises.ensureSubscriptionHasNoPendingChanges(
      paymentProviderSubscription
    )
    await SubscriptionGroupHandler.promises.ensureSubscriptionIsActive(
      subscription
    )
    await SubscriptionGroupHandler.promises.ensureSubscriptionHasNoPastDueInvoice(
      subscription
    )
    await SubscriptionGroupHandler.promises.checkBillingInfoExistence(
      paymentProviderSubscription,
      userId
    )
    await SubscriptionGroupHandler.promises.ensureSubscriptionHasAdditionalLicenseAddOnWhenCollectionMethodIsManual(
      paymentProviderSubscription
    )

    res.render('subscriptions/add-seats', {
      subscriptionId: subscription._id,
      groupName: subscription.teamName,
      totalLicenses: subscription.membersLimit,
      isProfessional: isProfessionalGroupPlan(subscription),
      isCollectionMethodManual:
        paymentProviderSubscription.isCollectionMethodManual,
      redirectedPaymentErrorCode: req.query.errorCode,
    })
  } catch (error) {
    if (error instanceof MissingBillingInfoError) {
      return res.redirect(
        '/user/subscription/group/missing-billing-information'
      )
    }

    if (error instanceof HasNoAdditionalLicenseWhenManuallyCollectedError) {
      return res.redirect(
        '/user/subscription/group/manually-collected-subscription'
      )
    }

    if (
      error instanceof PendingChangeError ||
      error instanceof InactiveError ||
      error instanceof HasPastDueInvoiceError
    ) {
      return res.redirect('/user/subscription')
    }

    logger.err(
      { error },
      'error while getting users group subscription details'
    )

    return res.redirect('/user/subscription')
  }
}

const previewAddSeatsSubscriptionChangeSchema = z.object({
  body: z.object({
    adding: z.number().int().min(1).max(MAX_NUMBER_OF_USERS),
    poNumber: z.string().max(MAX_NUMBER_OF_PO_NUMBER_CHARACTERS).optional(),
  }),
})

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
async function previewAddSeatsSubscriptionChange(req, res) {
  const { body } = parseReq(req, previewAddSeatsSubscriptionChangeSchema)
  try {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const preview =
      await SubscriptionGroupHandler.promises.previewAddSeatsSubscriptionChange(
        userId,
        body.adding
      )

    res.json(preview)
  } catch (error) {
    if (
      error instanceof MissingBillingInfoError ||
      error instanceof PendingChangeError ||
      error instanceof InactiveError ||
      error instanceof HasPastDueInvoiceError ||
      error instanceof HasNoAdditionalLicenseWhenManuallyCollectedError
    ) {
      return res.status(422).end()
    }

    if (error instanceof SubtotalLimitExceededError) {
      return res.status(422).json({
        code: 'subtotal_limit_exceeded',
        adding: body.adding,
      })
    }

    logger.err(
      { error },
      'error trying to preview "add seats" subscription change'
    )

    return res.status(500).end()
  }
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
async function createAddSeatsSubscriptionChange(req, res) {
  try {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const create =
      await SubscriptionGroupHandler.promises.createAddSeatsSubscriptionChange(
        userId,
        req.body.adding,
        req.body.poNumber
      )

    res.json(create)
  } catch (error) {
    if (
      error instanceof MissingBillingInfoError ||
      error instanceof PendingChangeError ||
      error instanceof InactiveError ||
      error instanceof HasPastDueInvoiceError ||
      error instanceof HasNoAdditionalLicenseWhenManuallyCollectedError
    ) {
      return res.status(422).end()
    }

    if (error instanceof SubtotalLimitExceededError) {
      return res.status(422).json({
        code: 'subtotal_limit_exceeded',
        adding: req.body.adding,
      })
    }

    if (error instanceof PaymentActionRequiredError) {
      return res.status(402).json({
        message: 'Payment action required',
        clientSecret: error.info.clientSecret,
        publicKey: error.info.publicKey,
      })
    }

    logger.err(
      { error },
      'error trying to create "add seats" subscription change'
    )

    return res.status(500).end()
  }
}

const submitFormSchema = z.object({
  body: z.object({
    adding: z.coerce.number().int().min(MAX_NUMBER_OF_USERS),
    poNumber: z.string().optional(),
  }),
})

async function submitForm(req, res) {
  const { body } = parseReq(req, submitFormSchema)
  const { adding, poNumber } = body

  const userId = SessionManager.getLoggedInUserId(req.session)
  const userEmail = await UserGetter.promises.getUserEmail(userId)

  const { paymentProviderSubscription } =
    await SubscriptionGroupHandler.promises.getUsersGroupSubscriptionDetails(
      userId
    )

  if (paymentProviderSubscription.isCollectionMethodManual) {
    await SubscriptionGroupHandler.promises.updateSubscriptionPaymentTerms(
      paymentProviderSubscription,
      poNumber
    )
  }

  const messageLines = [`\n**Overleaf Sales Contact Form:**`]
  messageLines.push('**Subject:** Self-Serve Group User Increase Request')
  messageLines.push(`**Estimated Number of Users:** ${adding}`)
  if (poNumber) {
    messageLines.push(`**PO Number:** ${poNumber}`)
  }
  messageLines.push(
    `**Message:** This email has been generated on behalf of user with email **${userEmail}** ` +
      'to request an increase in the total number of users for their subscription.'
  )
  const messageFormatted = messageLines.join('\n\n')

  const data = {
    email: userEmail,
    subject: 'Sales Contact Form',
    message: messageFormatted,
    inbox: 'sales',
  }

  await Modules.promises.hooks.fire('sendSupportRequest', data)
  res.sendStatus(204)
}

async function subscriptionUpgradePage(req, res) {
  try {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const changePreview =
      await SubscriptionGroupHandler.promises.getGroupPlanUpgradePreview(userId)
    const olSubscription = await Subscription.findOne({
      admin_id: userId,
    }).exec()
    res.render('subscriptions/upgrade-group-subscription-react', {
      changePreview,
      totalLicenses: olSubscription.membersLimit,
      groupName: olSubscription.teamName,
      redirectedPaymentErrorCode: req.query.errorCode,
    })
  } catch (error) {
    if (error instanceof MissingBillingInfoError) {
      return res.redirect(
        '/user/subscription/group/missing-billing-information'
      )
    }

    if (error instanceof ManuallyCollectedError) {
      return res.redirect(
        '/user/subscription/group/manually-collected-subscription'
      )
    }

    if (error instanceof SubtotalLimitExceededError) {
      return res.redirect('/user/subscription/group/subtotal-limit-exceeded')
    }

    if (error instanceof PendingChangeError || error instanceof InactiveError) {
      return res.redirect('/user/subscription')
    }

    logger.err({ error }, 'error loading upgrade subscription page')

    return res.redirect('/user/subscription')
  }
}

async function upgradeSubscription(req, res) {
  try {
    const userId = SessionManager.getLoggedInUserId(req.session)
    await SubscriptionGroupHandler.promises.upgradeGroupPlan(userId)
    return res.sendStatus(200)
  } catch (error) {
    if (error instanceof PaymentActionRequiredError) {
      return res.status(402).json({
        message: 'Payment action required',
        clientSecret: error.info.clientSecret,
        publicKey: error.info.publicKey,
      })
    }
    logger.err({ error }, 'error trying to upgrade subscription')
    return res.sendStatus(500)
  }
}

async function missingBillingInformation(req, res) {
  try {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const subscription =
      await SubscriptionLocator.promises.getUsersSubscription(userId)

    res.render('subscriptions/missing-billing-information', {
      groupName: subscription.teamName,
    })
  } catch (error) {
    logger.err(
      { error },
      'error trying to render missing billing information page'
    )
    return res.render('/user/subscription')
  }
}

async function manuallyCollectedSubscription(req, res) {
  try {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const subscription =
      await SubscriptionLocator.promises.getUsersSubscription(userId)

    res.render('subscriptions/manually-collected-subscription', {
      groupName: subscription.teamName,
    })
  } catch (error) {
    logger.err(
      { error },
      'error trying to render manually collected subscription page'
    )
    return res.render('/user/subscription')
  }
}

async function subtotalLimitExceeded(req, res) {
  try {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const subscription =
      await SubscriptionLocator.promises.getUsersSubscription(userId)

    res.render('subscriptions/subtotal-limit-exceeded', {
      groupName: subscription.teamName,
    })
  } catch (error) {
    logger.err({ error }, 'error trying to render subtotal limit exceeded page')
    return res.render('/user/subscription')
  }
}

async function getGroupPlanPerUserPrices(req, res) {
  try {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const prices = await Modules.promises.hooks.fire(
      'getGroupPlanPerUserPrices',
      userId,
      req.query.currency
    )
    return res.json(prices[0])
  } catch (error) {
    logger.err({ error }, 'error trying to get websale group product prices')
    return res.sendStatus(500)
  }
}

export default {
  removeUserFromGroup: expressify(removeUserFromGroup),
  removeSelfFromGroup: expressify(removeSelfFromGroup),
  addSeatsToGroupSubscription: expressify(addSeatsToGroupSubscription),
  submitForm: expressify(submitForm),
  previewAddSeatsSubscriptionChange: expressify(
    previewAddSeatsSubscriptionChange
  ),
  createAddSeatsSubscriptionChange: expressify(
    createAddSeatsSubscriptionChange
  ),
  subscriptionUpgradePage: expressify(subscriptionUpgradePage),
  upgradeSubscription: expressify(upgradeSubscription),
  missingBillingInformation: expressify(missingBillingInformation),
  manuallyCollectedSubscription: expressify(manuallyCollectedSubscription),
  subtotalLimitExceeded: expressify(subtotalLimitExceeded),
  getGroupPlanPerUserPrices: expressify(getGroupPlanPerUserPrices),
}
