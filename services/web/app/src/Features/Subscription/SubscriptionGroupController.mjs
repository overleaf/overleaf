// ts-check
import SubscriptionGroupHandler from './SubscriptionGroupHandler.js'

import OError from '@overleaf/o-error'
import logger from '@overleaf/logger'
import SubscriptionLocator from './SubscriptionLocator.js'
import SessionManager from '../Authentication/SessionManager.js'
import UserAuditLogHandler from '../User/UserAuditLogHandler.js'
import { expressify } from '@overleaf/promise-utils'
import Modules from '../../infrastructure/Modules.js'
import SplitTestHandler from '../SplitTests/SplitTestHandler.js'
import ErrorController from '../Errors/ErrorController.js'
import UserGetter from '../User/UserGetter.js'
import { Subscription } from '../../models/Subscription.js'
import { isProfessionalGroupPlan } from './PlansHelper.mjs'

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

  try {
    await SubscriptionGroupHandler.promises.removeUserFromGroup(
      subscriptionId,
      userToRemoveId
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
    const { subscription, plan } =
      await SubscriptionGroupHandler.promises.getUsersGroupSubscriptionDetails(
        req
      )
    await SubscriptionGroupHandler.promises.ensureFlexibleLicensingEnabled(plan)

    res.render('subscriptions/add-seats', {
      subscriptionId: subscription._id,
      groupName: subscription.teamName,
      totalLicenses: subscription.membersLimit,
      isProfessional: isProfessionalGroupPlan(subscription),
    })
  } catch (error) {
    logger.err(
      { error },
      'error while getting users group subscription details'
    )
    return res.redirect('/user/subscription')
  }
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
async function previewAddSeatsSubscriptionChange(req, res) {
  try {
    const preview =
      await SubscriptionGroupHandler.promises.previewAddSeatsSubscriptionChange(
        req
      )

    res.json(preview)
  } catch (error) {
    logger.err(
      { error },
      'error trying to preview "add seats" subscription change'
    )
    return res.status(400).end()
  }
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
async function createAddSeatsSubscriptionChange(req, res) {
  try {
    const create =
      await SubscriptionGroupHandler.promises.createAddSeatsSubscriptionChange(
        req
      )

    res.json(create)
  } catch (error) {
    logger.err(
      { error },
      'error trying to create "add seats" subscription change'
    )
    return res.status(400).end()
  }
}

async function submitForm(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const userEmail = await UserGetter.promises.getUserEmail(userId)
  const { adding } = req.body

  const messageLines = [`\n**Overleaf Sales Contact Form:**`]
  messageLines.push('**Subject:** Self-Serve Group User Increase Request')
  messageLines.push(`**Estimated Number of Users:** ${adding}`)
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

async function flexibleLicensingSplitTest(req, res, next) {
  const { variant } = await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'flexible-group-licensing'
  )

  if (variant !== 'enabled') {
    return ErrorController.notFound(req, res)
  }

  next()
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
    })
  } catch (error) {
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
    logger.err({ error }, 'error trying to upgrade subscription')
    return res.sendStatus(500)
  }
}

export default {
  removeUserFromGroup: expressify(removeUserFromGroup),
  removeSelfFromGroup: expressify(removeSelfFromGroup),
  addSeatsToGroupSubscription: expressify(addSeatsToGroupSubscription),
  submitForm: expressify(submitForm),
  flexibleLicensingSplitTest: expressify(flexibleLicensingSplitTest),
  previewAddSeatsSubscriptionChange: expressify(
    previewAddSeatsSubscriptionChange
  ),
  createAddSeatsSubscriptionChange: expressify(
    createAddSeatsSubscriptionChange
  ),
  subscriptionUpgradePage: expressify(subscriptionUpgradePage),
  upgradeSubscription: expressify(upgradeSubscription),
}
