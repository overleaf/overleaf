const SubscriptionGroupHandler = require('./SubscriptionGroupHandler')
const OError = require('@overleaf/o-error')
const logger = require('@overleaf/logger')
const SubscriptionLocator = require('./SubscriptionLocator')
const SessionManager = require('../Authentication/SessionManager')
const UserAuditLogHandler = require('../User/UserAuditLogHandler')

function removeUserFromGroup(req, res, next) {
  const subscription = req.entity
  const userToRemoveId = req.params.user_id
  const loggedInUserId = SessionManager.getLoggedInUserId(req.session)
  logger.debug(
    { subscriptionId: subscription._id, userToRemoveId },
    'removing user from group subscription'
  )
  UserAuditLogHandler.addEntry(
    userToRemoveId,
    'remove-from-group-subscription',
    loggedInUserId,
    req.ip,
    { subscriptionId: subscription._id },
    function (auditLogError) {
      if (auditLogError) {
        OError.tag(auditLogError, 'error adding audit log entry', {
          userToRemoveId,
          subscriptionId: subscription._id,
        })
        return next(auditLogError)
      }
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

      UserAuditLogHandler.addEntry(
        userToRemoveId,
        'remove-from-group-subscription',
        userToRemoveId,
        req.ip,
        { subscriptionId: subscription._id },
        function (auditLogError) {
          if (auditLogError) {
            OError.tag(auditLogError, 'error adding audit log entry', {
              userToRemoveId,
              subscriptionId,
            })
            return next(auditLogError)
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
  )
}

module.exports = {
  removeUserFromGroup,
  removeSelfFromGroup,
}
