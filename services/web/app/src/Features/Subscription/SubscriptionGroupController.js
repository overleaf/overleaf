/* eslint-disable
    camelcase,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SubscriptionGroupHandler = require('./SubscriptionGroupHandler')
const logger = require('logger-sharelatex')
const SubscriptionLocator = require('./SubscriptionLocator')
const AuthenticationController = require('../Authentication/AuthenticationController')
const _ = require('underscore')
const async = require('async')

module.exports = {
  removeUserFromGroup(req, res, next) {
    const subscription = req.entity
    const userToRemove_id = req.params.user_id
    logger.log(
      { subscriptionId: subscription._id, userToRemove_id },
      'removing user from group subscription'
    )
    return SubscriptionGroupHandler.removeUserFromGroup(
      subscription._id,
      userToRemove_id,
      function(err) {
        if (err != null) {
          logger.warn(
            { err, subscriptionId: subscription._id, userToRemove_id },
            'error removing user from group'
          )
          return next(err)
        }
        return res.send()
      }
    )
  },

  removeSelfFromGroup(req, res, next) {
    const adminUserId = req.query.admin_user_id
    const userToRemove_id = AuthenticationController.getLoggedInUserId(req)
    return getManagedSubscription(adminUserId, function(error, subscription) {
      if (error != null) {
        return next(error)
      }
      logger.log(
        { adminUserId, userToRemove_id },
        'removing user from group subscription after self request'
      )
      return SubscriptionGroupHandler.removeUserFromGroup(
        subscription._id,
        userToRemove_id,
        function(err) {
          if (err != null) {
            logger.err(
              { err, userToRemove_id, adminUserId },
              'error removing self from group'
            )
            return res.sendStatus(500)
          }
          return res.send()
        }
      )
    })
  },

  // legacy route
  redirectToSubscriptionGroupAdminPage(req, res, next) {
    const user_id = AuthenticationController.getLoggedInUserId(req)
    return getManagedSubscription(user_id, function(error, subscription) {
      if (error != null) {
        return next(error)
      }
      if (!(subscription != null ? subscription.groupPlan : undefined)) {
        return res.redirect('/user/subscription')
      }
      return res.redirect(`/manage/groups/${subscription._id}/members`)
    })
  }
}

var getManagedSubscription = (managerId, callback) =>
  SubscriptionLocator.findManagedSubscription(managerId, function(
    err,
    subscription
  ) {
    if (subscription != null) {
      logger.log({ managerId }, 'got managed subscription')
    } else {
      if (!err) {
        err = new Error(`No subscription found managed by user ${managerId}`)
      }
    }

    return callback(err, subscription)
  })
