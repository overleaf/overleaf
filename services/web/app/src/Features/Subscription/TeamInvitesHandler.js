const logger = require('@overleaf/logger')
const crypto = require('crypto')

const settings = require('@overleaf/settings')
const { ObjectId } = require('mongodb')

const { Subscription } = require('../../models/Subscription')

const UserGetter = require('../User/UserGetter')
const SubscriptionLocator = require('./SubscriptionLocator')
const SubscriptionUpdater = require('./SubscriptionUpdater')
const LimitationsManager = require('./LimitationsManager')
const ManagedUsersHandler = require('./ManagedUsersHandler')

const EmailHandler = require('../Email/EmailHandler')
const EmailHelper = require('../Helpers/EmailHelper')

const Errors = require('../Errors/Errors')
const { callbackify, callbackifyMultiResult } = require('../../util/promises')

async function getInvite(token) {
  const subscription = await Subscription.findOne({
    'teamInvites.token': token,
  })
  if (!subscription) {
    throw new Errors.NotFoundError('team not found')
  }

  const invite = subscription.teamInvites.find(i => i.token === token)
  return { invite, subscription }
}

async function createInvite(teamManagerId, subscription, email) {
  email = EmailHelper.parseEmail(email)
  if (!email) {
    throw new Error('invalid email')
  }
  const teamManager = await UserGetter.promises.getUser(teamManagerId)

  await _removeLegacyInvite(subscription.id, email)
  return _createInvite(subscription, email, teamManager)
}

async function importInvite(subscription, inviterName, email, token, sentAt) {
  const { possible, reason } = await _checkIfInviteIsPossible(
    subscription,
    email
  )
  if (!possible) {
    throw reason
  }
  subscription.teamInvites.push({
    email,
    inviterName,
    token,
    sentAt,
  })

  return subscription.save()
}

async function acceptInvite(token, userId) {
  const { invite, subscription } = await getInvite(token)
  if (!invite) {
    throw new Errors.NotFoundError('invite not found')
  }

  await SubscriptionUpdater.promises.addUserToGroup(subscription._id, userId)

  if (subscription.groupPolicy) {
    await ManagedUsersHandler.promises.enrollInSubscription(
      userId,
      subscription
    )
  }

  await _removeInviteFromTeam(subscription.id, invite.email)
}

async function revokeInvite(teamManagerId, subscription, email) {
  email = EmailHelper.parseEmail(email)
  if (!email) {
    throw new Error('invalid email')
  }
  await _removeInviteFromTeam(subscription.id, email)
}

// Legacy method to allow a user to receive a confirmation email if their
// email is in Subscription.invited_emails when they join. We'll remove this
// after a short while.
async function createTeamInvitesForLegacyInvitedEmail(email) {
  const teams = await SubscriptionLocator.promises.getGroupsWithEmailInvite(
    email
  )

  return Promise.all(
    teams.map(team => createInvite(team.admin_id, team, email))
  )
}

async function _createInvite(subscription, email, inviter) {
  const { possible, reason } = await _checkIfInviteIsPossible(
    subscription,
    email
  )

  if (!possible) {
    throw reason
  }

  // don't send invites when inviting self; add user directly to the group
  const isInvitingSelf = inviter.emails.some(
    emailData => emailData.email === email
  )
  if (isInvitingSelf) {
    await SubscriptionUpdater.promises.addUserToGroup(
      subscription._id,
      inviter._id
    )

    // legacy: remove any invite that might have been created in the past
    await _removeInviteFromTeam(subscription._id, email)

    return {
      email: inviter.email,
      first_name: inviter.first_name,
      last_name: inviter.last_name,
      invite: false,
    }
  }

  const inviterName = _getInviterName(inviter)
  let invite = subscription.teamInvites.find(invite => invite.email === email)

  if (invite) {
    invite = invite.toObject()
    invite.sentAt = new Date()
  } else {
    invite = {
      email,
      inviterName,
      token: crypto.randomBytes(32).toString('hex'),
      sentAt: new Date(),
    }
    subscription.teamInvites.push(invite)
  }

  await subscription.save()

  const opts = {
    to: email,
    inviter,
    acceptInviteUrl: `${settings.siteUrl}/subscription/invites/${invite.token}/`,
    appName: settings.appName,
  }
  await EmailHandler.promises.sendEmail('verifyEmailToJoinTeam', opts)
  Object.assign(invite, { invite: true })
  return invite
}

async function _removeInviteFromTeam(subscriptionId, email, callback) {
  const searchConditions = { _id: new ObjectId(subscriptionId.toString()) }
  const removeInvite = { $pull: { teamInvites: { email } } }

  await Subscription.updateOne(searchConditions, removeInvite)
  await _removeLegacyInvite(subscriptionId, email)
}

async function _removeLegacyInvite(subscriptionId, email) {
  await Subscription.updateOne(
    {
      _id: new ObjectId(subscriptionId.toString()),
    },
    {
      $pull: {
        invited_emails: email,
      },
    }
  )
}

async function _checkIfInviteIsPossible(subscription, email) {
  if (!subscription.groupPlan) {
    logger.debug(
      { subscriptionId: subscription.id },
      'can not add members to a subscription that is not in a group plan'
    )
    return { possible: false, reason: { wrongPlan: true } }
  }

  if (LimitationsManager.teamHasReachedMemberLimit(subscription)) {
    logger.debug(
      { subscriptionId: subscription.id },
      'team has reached member limit'
    )
    return { possible: false, reason: { limitReached: true } }
  }

  const existingUser = await UserGetter.promises.getUserByAnyEmail(email)
  if (!existingUser) {
    return { possible: true }
  }

  const existingMember = subscription.member_ids.find(
    memberId => memberId.toString() === existingUser._id.toString()
  )

  if (existingMember) {
    logger.debug(
      { subscriptionId: subscription.id, email },
      'user already in team'
    )
    return { possible: false, reason: { alreadyInTeam: true } }
  } else {
    return { possible: true }
  }
}

function _getInviterName(inviter) {
  let inviterName
  if (inviter.first_name && inviter.last_name) {
    inviterName = `${inviter.first_name} ${inviter.last_name} (${inviter.email})`
  } else {
    inviterName = inviter.email
  }

  return inviterName
}

module.exports = {
  getInvite: callbackifyMultiResult(getInvite, ['invite', 'subscription']),
  createInvite: callbackify(createInvite),
  importInvite: callbackify(importInvite),
  acceptInvite: callbackify(acceptInvite),
  revokeInvite: callbackify(revokeInvite),
  createTeamInvitesForLegacyInvitedEmail: callbackify(
    createTeamInvitesForLegacyInvitedEmail
  ),
  promises: {
    getInvite,
    createInvite,
    importInvite,
    acceptInvite,
    revokeInvite,
    createTeamInvitesForLegacyInvitedEmail,
  },
}
