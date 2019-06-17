let TeamInvitesHandler
const logger = require('logger-sharelatex')
const crypto = require('crypto')
const async = require('async')

const settings = require('settings-sharelatex')
const { ObjectId } = require('mongojs')

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
      if (err) {
        return callback(err)
      }
      if (!subscription) {
        return callback(new Errors.NotFoundError('team not found'))
      }

      const invite = subscription.teamInvites.find(i => i.token === token)
      callback(null, invite, subscription)
    })
  },

  createInvite(teamManagerId, subscription, email, callback) {
    email = EmailHelper.parseEmail(email)
    if (!email) {
      return callback(new Error('invalid email'))
    }
    logger.log({ teamManagerId, email }, 'Creating manager team invite')
    return UserGetter.getUser(teamManagerId, function(error, teamManager) {
      if (error) {
        return callback(error)
      }

      removeLegacyInvite(subscription.id, email, function(error) {
        if (error) {
          return callback(error)
        }
        createInvite(subscription, email, teamManager, callback)
      })
    })
  },

  importInvite(subscription, inviterName, email, token, sentAt, callback) {
    checkIfInviteIsPossible(subscription, email, function(
      error,
      possible,
      reason
    ) {
      if (error) {
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

      subscription.save(callback)
    })
  },

  acceptInvite(token, userId, callback) {
    logger.log({ userId }, 'Accepting invite')
    TeamInvitesHandler.getInvite(token, function(err, invite, subscription) {
      if (err) {
        return callback(err)
      }
      if (!invite) {
        return callback(new Errors.NotFoundError('invite not found'))
      }

      SubscriptionUpdater.addUserToGroup(subscription._id, userId, function(
        err
      ) {
        if (err) {
          return callback(err)
        }

        removeInviteFromTeam(subscription.id, invite.email, callback)
      })
    })
  },

  revokeInvite(teamManagerId, subscription, email, callback) {
    email = EmailHelper.parseEmail(email)
    if (!email) {
      return callback(new Error('invalid email'))
    }
    logger.log({ teamManagerId, email }, 'Revoking invite')
    removeInviteFromTeam(subscription.id, email, callback)
  },

  // Legacy method to allow a user to receive a confirmation email if their
  // email is in Subscription.invited_emails when they join. We'll remove this
  // after a short while.
  createTeamInvitesForLegacyInvitedEmail(email, callback) {
    SubscriptionLocator.getGroupsWithEmailInvite(email, function(err, teams) {
      if (err) {
        return callback(err)
      }

      async.map(
        teams,
        (team, cb) =>
          TeamInvitesHandler.createInvite(team.admin_id, team, email, cb),
        callback
      )
    })
  }
}

var createInvite = function(subscription, email, inviter, callback) {
  logger.log(
    { subscriptionId: subscription.id, email, inviterId: inviter._id },
    'Creating invite'
  )
  checkIfInviteIsPossible(subscription, email, function(
    error,
    possible,
    reason
  ) {
    if (error) {
      return callback(error)
    }
    if (!possible) {
      return callback(reason)
    }

    // don't send invites when inviting self; add user directly to the group
    const isInvitingSelf = inviter.emails.some(
      emailData => emailData.email === email
    )
    if (isInvitingSelf) {
      return SubscriptionUpdater.addUserToGroup(
        subscription._id,
        inviter._id,
        err => {
          if (err) {
            return callback(err)
          }

          // legacy: remove any invite that might have been created in the past
          removeInviteFromTeam(subscription._id, email, error => {
            const inviteUserData = {
              email: inviter.email,
              first_name: inviter.first_name,
              last_name: inviter.last_name,
              invite: false
            }
            callback(error, inviteUserData)
          })
        }
      )
    }

    const inviterName = getInviterName(inviter)
    let invite = subscription.teamInvites.find(invite => invite.email === email)

    if (invite) {
      invite.sentAt = new Date()
    } else {
      invite = {
        email,
        inviterName,
        token: crypto.randomBytes(32).toString('hex'),
        sentAt: new Date()
      }
      subscription.teamInvites.push(invite)
    }

    subscription.save(function(error) {
      if (error) {
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
      EmailHandler.sendEmail('verifyEmailToJoinTeam', opts, error => {
        Object.assign(invite, { invite: true })
        callback(error, invite)
      })
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

  async.series(
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

  UserGetter.getUserByAnyEmail(email, function(error, existingUser) {
    if (error) {
      return callback(error)
    }
    if (!existingUser) {
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
      callback(null, false, { alreadyInTeam: true })
    } else {
      callback(null, true)
    }
  })
}

var getInviterName = function(inviter) {
  let inviterName
  if (inviter.first_name && inviter.last_name) {
    inviterName = `${inviter.first_name} ${inviter.last_name} (${
      inviter.email
    })`
  } else {
    inviterName = inviter.email
  }

  return inviterName
}
