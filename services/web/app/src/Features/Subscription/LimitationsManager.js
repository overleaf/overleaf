/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    standard/no-callback-literal,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let LimitationsManager
const logger = require('logger-sharelatex')
const ProjectGetter = require('../Project/ProjectGetter')
const UserGetter = require('../User/UserGetter')
const SubscriptionLocator = require('./SubscriptionLocator')
const Settings = require('settings-sharelatex')
const CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')
const CollaboratorsInvitesHandler = require('../Collaborators/CollaboratorsInviteHandler')
const V1SubscriptionManager = require('./V1SubscriptionManager')

module.exports = LimitationsManager = {
  allowedNumberOfCollaboratorsInProject(project_id, callback) {
    return ProjectGetter.getProject(
      project_id,
      { owner_ref: true },
      (error, project) => {
        if (error != null) {
          return callback(error)
        }
        return this.allowedNumberOfCollaboratorsForUser(
          project.owner_ref,
          callback
        )
      }
    )
  },

  allowedNumberOfCollaboratorsForUser(user_id, callback) {
    return UserGetter.getUser(user_id, { features: 1 }, function(error, user) {
      if (error != null) {
        return callback(error)
      }
      if (user.features != null && user.features.collaborators != null) {
        return callback(null, user.features.collaborators)
      } else {
        return callback(null, Settings.defaultFeatures.collaborators)
      }
    })
  },

  canAddXCollaborators(project_id, x_collaborators, callback) {
    if (callback == null) {
      callback = function(error, allowed) {}
    }
    return this.allowedNumberOfCollaboratorsInProject(
      project_id,
      (error, allowed_number) => {
        if (error != null) {
          return callback(error)
        }
        return CollaboratorsHandler.getInvitedCollaboratorCount(
          project_id,
          (error, current_number) => {
            if (error != null) {
              return callback(error)
            }
            return CollaboratorsInvitesHandler.getInviteCount(
              project_id,
              (error, invite_count) => {
                if (error != null) {
                  return callback(error)
                }
                if (
                  current_number + invite_count + x_collaborators <=
                    allowed_number ||
                  allowed_number < 0
                ) {
                  return callback(null, true)
                } else {
                  return callback(null, false)
                }
              }
            )
          }
        )
      }
    )
  },

  hasPaidSubscription(user, callback) {
    if (callback == null) {
      callback = function(err, hasSubscriptionOrIsMember) {}
    }
    return this.userHasV2Subscription(
      user,
      (err, hasSubscription, subscription) => {
        if (err != null) {
          return callback(err)
        }
        return this.userIsMemberOfGroupSubscription(user, (err, isMember) => {
          if (err != null) {
            return callback(err)
          }
          return this.userHasV1Subscription(user, (err, hasV1Subscription) => {
            if (err != null) {
              return callback(err)
            }
            logger.log(
              {
                user_id: user._id,
                isMember,
                hasSubscription,
                hasV1Subscription
              },
              'checking if user has subscription or is group member'
            )
            return callback(
              err,
              isMember || hasSubscription || hasV1Subscription,
              subscription
            )
          })
        })
      }
    )
  },

  // alias for backward-compatibility with modules. Use `haspaidsubscription` instead
  userHasSubscriptionOrIsGroupMember(user, callback) {
    return this.hasPaidSubscription(user, callback)
  },

  userHasV2Subscription(user, callback) {
    if (callback == null) {
      callback = function(err, hasSubscription, subscription) {}
    }
    logger.log({ user_id: user._id }, 'checking if user has subscription')
    return SubscriptionLocator.getUsersSubscription(user._id, function(
      err,
      subscription
    ) {
      if (err != null) {
        return callback(err)
      }
      const hasValidSubscription =
        subscription != null &&
        (subscription.recurlySubscription_id != null ||
          (subscription != null ? subscription.customAccount : undefined) ===
            true)
      logger.log(
        { user, hasValidSubscription, subscription },
        'checking if user has subscription'
      )
      return callback(err, hasValidSubscription, subscription)
    })
  },

  userHasV1OrV2Subscription(user, callback) {
    if (callback == null) {
      callback = function(err, hasSubscription) {}
    }
    return this.userHasV2Subscription(user, (err, hasV2Subscription) => {
      if (err != null) {
        return callback(err)
      }
      if (hasV2Subscription) {
        return callback(null, true)
      }
      return this.userHasV1Subscription(user, (err, hasV1Subscription) => {
        if (err != null) {
          return callback(err)
        }
        if (hasV1Subscription) {
          return callback(null, true)
        }
        return callback(null, false)
      })
    })
  },

  userIsMemberOfGroupSubscription(user, callback) {
    if (callback == null) {
      callback = function(error, isMember, subscriptions) {}
    }
    logger.log(
      { user_id: user._id },
      'checking is user is member of subscription groups'
    )
    return SubscriptionLocator.getMemberSubscriptions(user._id, function(
      err,
      subscriptions
    ) {
      if (subscriptions == null) {
        subscriptions = []
      }
      if (err != null) {
        return callback(err)
      }
      return callback(err, subscriptions.length > 0, subscriptions)
    })
  },

  userHasV1Subscription(user, callback) {
    if (callback == null) {
      callback = function(error, hasV1Subscription) {}
    }
    return V1SubscriptionManager.getSubscriptionsFromV1(user._id, function(
      err,
      v1Subscription
    ) {
      logger.log(
        { user_id: user._id, v1Subscription },
        '[userHasV1Subscription]'
      )
      return callback(
        err,
        !!(v1Subscription != null ? v1Subscription.has_subscription : undefined)
      )
    })
  },

  teamHasReachedMemberLimit(subscription) {
    const currentTotal =
      (subscription.member_ids || []).length +
      (subscription.teamInvites || []).length +
      (subscription.invited_emails || []).length

    return currentTotal >= subscription.membersLimit
  },

  hasGroupMembersLimitReached(subscriptionId, callback) {
    if (callback == null) {
      callback = function(err, limitReached, subscription) {}
    }
    return SubscriptionLocator.getSubscription(subscriptionId, function(
      err,
      subscription
    ) {
      if (err != null) {
        logger.warn({ err, subscriptionId }, 'error getting subscription')
        return callback(err)
      }
      if (subscription == null) {
        logger.warn({ subscriptionId }, 'no subscription found')
        return callback(new Error('no subscription found'))
      }

      const limitReached = LimitationsManager.teamHasReachedMemberLimit(
        subscription
      )
      return callback(err, limitReached, subscription)
    })
  }
}
