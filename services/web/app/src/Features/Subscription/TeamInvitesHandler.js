/* eslint-disable
    handle-callback-err,
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
let TeamInvitesHandler
const logger = require('logger-sharelatex')
const crypto = require('crypto')
const async = require('async')

const settings = require('settings-sharelatex')
const { ObjectId } = require('mongojs')

const { TeamInvite } = require('../../models/TeamInvite')
const { Subscription } = require('../../models/Subscription')

const UserGetter = require('../User/UserGetter')
const SubscriptionLocator = require('./SubscriptionLocator')
const SubscriptionUpdater = require('./SubscriptionUpdater')
const LimitationsManager = require('./LimitationsManager')

const EmailHandler = require('../Email/EmailHandler')
const EmailHelper = require('../Helpers/EmailHelper')

const Errors = require('../Errors/Errors')

module.exports = TeamInvitesHandler = {
  getInvite(token, callback) {
    return Subscription.findOne({ 'teamInvites.token': token }, function(
      err,
      subscription
    ) {
      if (err != null) {
        return callback(err)
      }
      if (subscription == null) {
        return callback(new Errors.NotFoundError('team not found'))
      }

      const invite = subscription.teamInvites.find(i => i.token === token)
      return callback(null, invite, subscription)
    })
  },

  createInvite(teamManagerId, subscription, email, callback) {
    email = EmailHelper.parseEmail(email)
    if (email == null) {
      return callback(new Error('invalid email'))
    }
    logger.log({ teamManagerId, email }, 'Creating manager team invite')
    return UserGetter.getUser(teamManagerId, function(error, teamManager) {
      let inviterName
      if (error != null) {
        return callback(error)
      }

      if (teamManager.first_name && teamManager.last_name) {
        inviterName = `${teamManager.first_name} ${teamManager.last_name} (${
          teamManager.email
        })`
      } else {
        inviterName = teamManager.email
      }

      return removeLegacyInvite(subscription.id, email, function(error) {
        if (error != null) {
          return callback(error)
        }
        return createInvite(subscription, email, inviterName, callback)
      })
    })
  },

  importInvite(subscription, inviterName, email, token, sentAt, callback) {
    return checkIfInviteIsPossible(subscription, email, function(
      error,
      possible,
      reason
    ) {
      if (error != null) {
        return callback(error)
      }
      if (!possible) {
        return callback(reason)
      }

      subscription.teamInvites.push({
        email,
        inviterName,
        token,
        sentAt
      })

      return subscription.save(callback)
    })
  },

  acceptInvite(token, userId, callback) {
    logger.log({ userId }, 'Accepting invite')
    return TeamInvitesHandler.getInvite(token, function(
      err,
      invite,
      subscription
    ) {
      if (err != null) {
        return callback(err)
      }
      if (invite == null) {
        return callback(new Errors.NotFoundError('invite not found'))
      }

      return SubscriptionUpdater.addUserToGroup(
        subscription._id,
        userId,
        function(err) {
          if (err != null) {
            return callback(err)
          }

          return removeInviteFromTeam(subscription.id, invite.email, callback)
        }
      )
    })
  },

  revokeInvite(teamManagerId, subscription, email, callback) {
    email = EmailHelper.parseEmail(email)
    if (email == null) {
      return callback(new Error('invalid email'))
    }
    logger.log({ teamManagerId, email }, 'Revoking invite')
    return removeInviteFromTeam(subscription.id, email, callback)
  },

  // Legacy method to allow a user to receive a confirmation email if their
  // email is in Subscription.invited_emails when they join. We'll remove this
  // after a short while.
  createTeamInvitesForLegacyInvitedEmail(email, callback) {
    return SubscriptionLocator.getGroupsWithEmailInvite(email, function(
      err,
      teams
    ) {
      if (err != null) {
        return callback(err)
      }

      return async.map(
        teams,
        (team, cb) =>
          TeamInvitesHandler.createInvite(team.admin_id, team, email, cb),
        callback
      )
    })
  }
}

var createInvite = function(subscription, email, inviterName, callback) {
  logger.log(
    { subscriptionId: subscription.id, email, inviterName },
    'Creating invite'
  )
  return checkIfInviteIsPossible(subscription, email, function(
    error,
    possible,
    reason
  ) {
    if (error != null) {
      return callback(error)
    }
    if (!possible) {
      return callback(reason)
    }

    let invite = subscription.teamInvites.find(invite => invite.email === email)

    if (invite == null) {
      invite = {
        email,
        inviterName,
        token: crypto.randomBytes(32).toString('hex'),
        sentAt: new Date()
      }
      subscription.teamInvites.push(invite)
    } else {
      invite.sentAt = new Date()
    }

    return subscription.save(function(error) {
      if (error != null) {
        return callback(error)
      }

      const opts = {
        to: email,
        inviterName,
        acceptInviteUrl: `${settings.siteUrl}/subscription/invites/${
          invite.token
        }/`,
        appName: settings.appName
      }
      return EmailHandler.sendEmail('verifyEmailToJoinTeam', opts, error =>
        callback(error, invite)
      )
    })
  })
}

var removeInviteFromTeam = function(subscriptionId, email, callback) {
  const searchConditions = { _id: new ObjectId(subscriptionId.toString()) }
  const removeInvite = { $pull: { teamInvites: { email } } }
  logger.log(
    { subscriptionId, email, searchConditions, removeInvite },
    'removeInviteFromTeam'
  )

  return async.series(
    [
      cb => Subscription.update(searchConditions, removeInvite, cb),
      cb => removeLegacyInvite(subscriptionId, email, cb)
    ],
    callback
  )
}

var removeLegacyInvite = (subscriptionId, email, callback) =>
  Subscription.update(
    {
      _id: new ObjectId(subscriptionId.toString())
    },
    {
      $pull: {
        invited_emails: email
      }
    },
    callback
  )

var checkIfInviteIsPossible = function(subscription, email, callback) {
  if (callback == null) {
    callback = function(error, possible, reason) {}
  }
  if (!subscription.groupPlan) {
    logger.log(
      { subscriptionId: subscription.id },
      'can not add members to a subscription that is not in a group plan'
    )
    return callback(null, false, { wrongPlan: true })
  }

  if (LimitationsManager.teamHasReachedMemberLimit(subscription)) {
    logger.log(
      { subscriptionId: subscription.id },
      'team has reached member limit'
    )
    return callback(null, false, { limitReached: true })
  }

  return UserGetter.getUserByAnyEmail(email, function(error, existingUser) {
    if (error != null) {
      return callback(error)
    }
    if (existingUser == null) {
      return callback(null, true)
    }

    const existingMember = subscription.member_ids.find(
      memberId => memberId.toString() === existingUser._id.toString()
    )

    if (existingMember) {
      logger.log(
        { subscriptionId: subscription.id, email },
        'user already in team'
      )
      return callback(null, false, { alreadyInTeam: true })
    } else {
      return callback(null, true)
    }
  })
}
