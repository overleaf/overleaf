const SubscriptionGroupHandler = require('./SubscriptionGroupHandler')
const OError = require('@overleaf/o-error')
const logger = require('@overleaf/logger')
const SubscriptionLocator = require('./SubscriptionLocator')
const SessionManager = require('../Authentication/SessionManager')

function removeUserFromGroup(req, res, next) {
  const subscription = req.entity
  const userToRemoveId = req.params.user_id
  logger.debug(
    { subscriptionId: subscription._id, userToRemoveId },
    'removing user from group subscription'
  )
  SubscriptionGroupHandler.removeUserFromGroup(
    subscription._id,
    userToRemoveId,
    function (error) {
      if (error) {
        OError.tag(error, 'error removing user from group', {
          subscriptionId: subscription._id,
          userToRemove_id: userToRemoveId,
        })
        return next(error)
      }

      res.sendStatus(200)
    }
  )
}

function removeSelfFromGroup(req, res, next) {
  const subscriptionId = req.query.subscriptionId
  const userToRemoveId = SessionManager.getLoggedInUserId(req.session)
  SubscriptionLocator.getSubscription(
    subscriptionId,
    function (error, subscription) {
      if (error) {
        return next(error)
      }

      SubscriptionGroupHandler.removeUserFromGroup(
        subscription._id,
        userToRemoveId,
        function (error) {
          if (error) {
            logger.err(
              { err: error, userToRemoveId, subscriptionId },
              'error removing self from group'
            )
            return res.sendStatus(500)
          }
          res.sendStatus(200)
        }
      )
    }
  )
}

module.exports = {
  removeUserFromGroup,
  removeSelfFromGroup,
}
