import logger from '@overleaf/logger'
import crypto from 'node:crypto'
import settings from '@overleaf/settings'
import Modules from '../../infrastructure/Modules.mjs'
import mongodb from 'mongodb-legacy'
import { Subscription } from '../../models/Subscription.mjs'
import { SSOConfig } from '../../models/SSOConfig.mjs'
import UserGetter from '../User/UserGetter.mjs'
import SubscriptionLocator from './SubscriptionLocator.mjs'
import SubscriptionUpdater from './SubscriptionUpdater.mjs'
import LimitationsManager from './LimitationsManager.mjs'
import EmailHandler from '../Email/EmailHandler.mjs'
import EmailHelper from '../Helpers/EmailHelper.mjs'
import Errors from '../Errors/Errors.js'
import { callbackify, callbackifyMultiResult } from '@overleaf/promise-utils'
import NotificationsBuilder from '../Notifications/NotificationsBuilder.mjs'

const { ObjectId } = mongodb

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

async function createInvite(teamManagerId, subscription, email, auditLog) {
  email = EmailHelper.parseEmail(email)
  if (!email) {
    throw new Error('invalid email')
  }
  const teamManager = await UserGetter.promises.getUser(teamManagerId)

  await _removeLegacyInvite(subscription.id, email)
  return _createInvite(subscription, email, teamManager, auditLog)
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

async function _deleteUserSubscription(subscription, userId, ipAddress) {
  // Delete released user subscription to make it on a free plan

  logger.debug(
    {
      subscriptionId: subscription._id,
    },
    'deleting user subscription'
  )

  const deleterData = {
    id: userId,
    ip: ipAddress,
  }
  await SubscriptionUpdater.promises.deleteSubscription(
    subscription,
    deleterData
  )

  try {
    await Modules.promises.hooks.fire('terminateSubscription', subscription)
  } catch (err) {
    logger.error(
      { err, subscriptionId: subscription._id },
      'terminating subscription failed'
    )
  }
}

async function removeTeamInviteAndNotification(subscriptionId, userId, email) {
  await _removeInviteFromTeam(subscriptionId, email)

  await NotificationsBuilder.promises
    .groupInvitation(userId, subscriptionId, false)
    .read()
}

async function acceptInvite(token, userId, ipAddress) {
  const { invite, subscription } = await getInvite(token)
  if (!invite) {
    throw new Errors.NotFoundError('invite not found')
  }
  const auditLog = { initiatorId: userId, ipAddress }

  await SubscriptionUpdater.promises.addUserToGroup(
    subscription._id,
    userId,
    auditLog
  )

  if (subscription.managedUsersEnabled) {
    // check if user has a personal subscription
    const userSubscription =
      await SubscriptionLocator.promises.getUsersSubscription(userId)

    if (userSubscription) {
      // if user has a personal subscription and joins a managed group, delete their personal subscription
      // but make sure that it's not the same subscription as the group one.
      if (!userSubscription._id.equals(subscription._id)) {
        await _deleteUserSubscription(userSubscription, userId, ipAddress)
      }
    }
    await Modules.promises.hooks.fire(
      'enrollInManagedSubscription',
      userId,
      subscription,
      auditLog
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

  await removeTeamInviteAndNotification(subscription._id, userId, invite.email)

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

async function _createInvite(subscription, email, inviter, auditLog) {
  const { domainCaptureEnabled, managedUsersEnabled } = subscription
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
    const auditLog = { initiatorId: inviter._id }
    await SubscriptionUpdater.promises.addUserToGroup(
      subscription._id,
      inviter._id,
      auditLog
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
    if (domainCaptureEnabled) {
      invite = {
        email,
        inviterName,
        sentAt: new Date(),
        domainCapture: true,
      }
    } else {
      invite = {
        email,
        inviterName,
        token: crypto.randomBytes(32).toString('hex'),
        sentAt: new Date(),
      }
    }

    subscription.teamInvites.push(invite)
  }

  if (!domainCaptureEnabled) {
    // no need to create notification when domain capture is enabled since
    // dash will show one on page load for non-managed groups, and for managed groups
    // dash is not loadable until user joins the group
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
  }

  await subscription.save()

  if (subscription.managedUsersEnabled) {
    const auditLogData = {
      initiatorId: auditLog?.initiatorId,
      ipAddress: auditLog?.ipAddress,
      groupId: subscription._id,
      operation: 'group-invite-sent',
      info: { invitedEmail: email },
    }

    try {
      await Modules.promises.hooks.fire('addGroupAuditLogEntry', auditLogData)
    } catch (error) {
      logger.error(
        { error, auditLog },
        'Error adding group audit log entry for group-invite-sent'
      )
    }
  }

  let acceptInviteUrl
  if (domainCaptureEnabled) {
    const samlInitPath = (
      await Modules.promises.hooks.fire(
        'getGroupSSOInitPath',
        subscription,
        email
      )
    )?.[0]
    acceptInviteUrl = `${settings.siteUrl}${samlInitPath}`
  } else {
    acceptInviteUrl = `${settings.siteUrl}/subscription/invites/${invite.token}/`
  }
  if (managedUsersEnabled) {
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
      acceptInviteUrl,
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
      acceptInviteUrl,
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

export default {
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
    removeTeamInviteAndNotification,
    revokeInvite,
    createTeamInvitesForLegacyInvitedEmail,
  },
}
