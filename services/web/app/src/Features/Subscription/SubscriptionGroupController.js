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
const OError = require('@overleaf/o-error')
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
      function (err) {
        if (err != null) {
          OError.tag(err, 'error removing user from group', {
            subscriptionId: subscription._id,
            userToRemove_id
          })
          return next(err)
        }
        return res.sendStatus(200)
      }
    )
  },

  removeSelfFromGroup(req, res, next) {
    const subscriptionId = req.query.subscriptionId
    const userToRemove_id = AuthenticationController.getLoggedInUserId(req)
    return SubscriptionLocator.getSubscription(
      subscriptionId,
      function (error, subscription) {
        if (error != null) {
          return next(error)
        }

        return SubscriptionGroupHandler.removeUserFromGroup(
          subscription._id,
          userToRemove_id,
          function (err) {
            if (err != null) {
              logger.err(
                { err, userToRemove_id, subscriptionId },
                'error removing self from group'
              )
              return res.sendStatus(500)
            }
            return res.sendStatus(200)
          }
        )
      }
    )
  }
}
