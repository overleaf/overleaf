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

/**
 * @import { Subscription } from "../../../../types/subscription/dashboard/subscription"
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

async function requestConfirmation(req, res) {
  const { variant } = await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'flexible-group-licensing'
  )

  if (variant !== 'enabled') {
    return ErrorController.notFound(req, res)
  }

  try {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const subscription =
      await SubscriptionLocator.promises.getUsersSubscription(userId)

    res.render('subscriptions/request-confirmation-react', {
      groupName: subscription.teamName,
    })
  } catch (error) {
    logger.err({ error }, 'error trying to request seats to subscription')
    return res.render('/user/subscription')
  }
}

export default {
  removeUserFromGroup: expressify(removeUserFromGroup),
  removeSelfFromGroup: expressify(removeSelfFromGroup),
  requestConfirmation: expressify(requestConfirmation),
}
