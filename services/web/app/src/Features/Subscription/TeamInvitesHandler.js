const logger = require('@overleaf/logger')
const crypto = require('crypto')

const settings = require('@overleaf/settings')
const Modules = require('../../infrastructure/Modules')
const { ObjectId } = require('mongodb-legacy')

const { Subscription } = require('../../models/Subscription')
const { SSOConfig } = require('../../models/SSOConfig')

const UserGetter = require('../User/UserGetter')
const SubscriptionLocator = require('./SubscriptionLocator')
const SubscriptionUpdater = require('./SubscriptionUpdater')
const LimitationsManager = require('./LimitationsManager')

const EmailHandler = require('../Email/EmailHandler')
const EmailHelper = require('../Helpers/EmailHelper')

const Errors = require('../Errors/Errors')
const {
  callbackify,
  callbackifyMultiResult,
} = require('@overleaf/promise-utils')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')

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

  if (subscription.managedUsersEnabled) {
    await Modules.promises.hooks.fire(
      'enrollInManagedSubscription',
      userId,
      subscription
    )
  }
  if (subscription.ssoConfig) {
    const ssoConfig = await SSOConfig.findById(
      subscription.ssoConfig._id || subscription.ssoConfig
    )
    if (ssoConfig?.enabled) {
      await Modules.promises.hooks.fire(
        'scheduleGroupSSOReminder',
        userId,
        subscription._id
      )
    }
  }

  await _removeInviteFromTeam(subscription.id, invite.email)

  await NotificationsBuilder.promises
    .groupInvitation(userId, subscription._id, false)
    .read()

  return subscription
}

async function revokeInvite(teamManagerId, subscription, email) {
  email = EmailHelper.parseEmail(email)

  if (!email) {
    throw new Error('invalid email')
  }

  await _removeInviteFromTeam(subscription.id, email)

  // Remove group invitation dashboard notification if invitation is revoked before
  // the invited user accepted the group invitation
  const user = await UserGetter.promises.getUserByAnyEmail(email)
  if (user) {
    await NotificationsBuilder.promises
      .groupInvitation(user._id, subscription._id, false)
      .read()
  }
}

// Legacy method to allow a user to receive a confirmation email if their
// email is in Subscription.invited_emails when they join. We'll remove this
// after a short while.
async function createTeamInvitesForLegacyInvitedEmail(email) {
  const teams =
    await SubscriptionLocator.promises.getGroupsWithEmailInvite(email)
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

    try {
      if (subscription.ssoConfig) {
        const ssoConfig = await SSOConfig.findById(
          subscription.ssoConfig._id || subscription.ssoConfig
        )
        if (ssoConfig?.enabled) {
          await Modules.promises.hooks.fire(
            'sendGroupSSOReminder',
            inviter._id,
            subscription._id
          )
        }
      }
    } catch (error) {
      logger.error(
        { err: error, userId: inviter._id, subscriptionId: subscription._id },
        'Failed to schedule Group SSO invite for group admin'
      )
    }

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

  try {
    await _sendNotificationToExistingUser(
      subscription,
      email,
      invite,
      subscription.managedUsersEnabled
    )
  } catch (err) {
    logger.error(
      { err },
      'Failed to send notification to existing user when creating group invitation'
    )
  }

  await subscription.save()

  if (subscription.managedUsersEnabled) {
    let admin = {}
    try {
      admin = await SubscriptionLocator.promises.getAdminEmailAndName(
        subscription._id
      )
    } catch (err) {
      logger.error({ err }, 'error getting subscription admin email and name')
    }

    const user = await UserGetter.promises.getUserByAnyEmail(email)

    const opts = {
      to: email,
      admin,
      inviter,
      acceptInviteUrl: `${settings.siteUrl}/subscription/invites/${invite.token}/`,
      appName: settings.appName,
    }

    if (user) {
      await EmailHandler.promises.sendEmail(
        'verifyEmailToJoinManagedUsers',
        opts
      )
    } else {
      await EmailHandler.promises.sendEmail(
        'inviteNewUserToJoinManagedUsers',
        opts
      )
    }
  } else {
    const opts = {
      to: email,
      inviter,
      acceptInviteUrl: `${settings.siteUrl}/subscription/invites/${invite.token}/`,
      appName: settings.appName,
    }

    await EmailHandler.promises.sendEmail('verifyEmailToJoinTeam', opts)
  }

  Object.assign(invite, { invite: true })
  return invite
}

async function _removeInviteFromTeam(subscriptionId, email, callback) {
  const searchConditions = { _id: new ObjectId(subscriptionId.toString()) }
  const removeInvite = { $pull: { teamInvites: { email } } }

  await Subscription.updateOne(searchConditions, removeInvite)
  await _removeLegacyInvite(subscriptionId, email)
}

async function _sendNotificationToExistingUser(
  subscription,
  email,
  invite,
  managedUsersEnabled
) {
  const user = await UserGetter.promises.getUserByMainEmail(email)

  if (!user) {
    return
  }

  await NotificationsBuilder.promises
    .groupInvitation(
      user._id.toString(),
      subscription._id.toString(),
      managedUsersEnabled
    )
    .create(invite)
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
