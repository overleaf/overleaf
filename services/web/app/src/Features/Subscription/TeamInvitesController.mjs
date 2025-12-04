import settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'
import TeamInvitesHandler from './TeamInvitesHandler.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import SubscriptionLocator from './SubscriptionLocator.mjs'
import SubscriptionHelper from './SubscriptionHelper.mjs'
import ErrorController from '../Errors/ErrorController.mjs'
import EmailHelper from '../Helpers/EmailHelper.mjs'
import UserGetter from '../User/UserGetter.mjs'
import { expressify } from '@overleaf/promise-utils'
import HttpErrorHandler from '../Errors/HttpErrorHandler.mjs'
import PermissionsManager from '../Authorization/PermissionsManager.mjs'
import EmailHandler from '../Email/EmailHandler.mjs'
import { RateLimiter } from '../../infrastructure/RateLimiter.mjs'
import Modules from '../../infrastructure/Modules.mjs'
import UserAuditLogHandler from '../User/UserAuditLogHandler.mjs'
import { sanitizeSessionUserForFrontEnd } from '../../infrastructure/FrontEndUser.mjs'

const rateLimiters = {
  resendGroupInvite: new RateLimiter('resend-group-invite', {
    points: 1,
    duration: 60 * 60,
  }),
}

async function createInvite(req, res, next) {
  const teamManagerId = SessionManager.getLoggedInUserId(req.session)
  const subscription = req.entity
  const email = EmailHelper.parseEmail(req.body.email)
  if (!email) {
    return res.status(422).json({
      error: {
        code: 'invalid_email',
        message: req.i18n.translate('invalid_email'),
      },
    })
  }

  try {
    const auditLog = {
      initiatorId: teamManagerId,
      ipAddress: req.ip,
    }
    const invitedUserData = await TeamInvitesHandler.promises.createInvite(
      teamManagerId,
      subscription,
      email,
      auditLog
    )
    return res.json({ user: invitedUserData })
  } catch (err) {
    if (err.alreadyInTeam) {
      return res.status(400).json({
        error: {
          code: 'user_already_added',
          message: req.i18n.translate('user_already_added'),
        },
      })
    }
    if (err.limitReached) {
      return res.status(400).json({
        error: {
          code: 'group_full',
          message: req.i18n.translate('group_full'),
        },
      })
    }
  }
}

async function viewInvite(req, res, next) {
  const { token } = req.params
  const sessionUser = SessionManager.getSessionUser(req.session)
  const userId = sessionUser?._id
  const { invite, subscription } =
    await TeamInvitesHandler.promises.getInvite(token)

  if (!invite) {
    return ErrorController.notFound(req, res)
  }

  const groupSSOActive = (
    await Modules.promises.hooks.fire('hasGroupSSOEnabled', subscription)
  )?.[0]

  let validationStatus = new Map()
  if (userId) {
    const personalSubscription =
      await SubscriptionLocator.promises.getUsersSubscription(userId)

    const hasIndividualPaidSubscription =
      SubscriptionHelper.isIndividualActivePaidSubscription(
        personalSubscription
      )

    if (subscription?.managedUsersEnabled) {
      if (!subscription.populated('groupPolicy')) {
        // eslint-disable-next-line no-restricted-syntax
        await subscription.populate('groupPolicy')
      }

      const dbUser = await UserGetter.promises.getUser(userId)

      const isUserEnrolledInDifferentGroup =
        (
          await Modules.promises.hooks.fire(
            'isUserEnrolledInDifferentGroup',
            dbUser.enrollment,
            subscription._id
          )
        )?.[0] === true
      if (isUserEnrolledInDifferentGroup) {
        return HttpErrorHandler.forbidden(
          req,
          res,
          'User is already enrolled in a different subscription'
        )
      }

      validationStatus =
        await PermissionsManager.promises.getUserValidationStatus({
          user: dbUser,
          groupPolicy: subscription.groupPolicy,
          subscription,
        })

      let currentManagedUserAdminEmail
      try {
        currentManagedUserAdminEmail =
          await SubscriptionLocator.promises.getAdminEmail(subscription._id)
      } catch (err) {
        logger.error({ err }, 'error getting subscription admin email')
      }

      const usersSubscription =
        await SubscriptionLocator.promises.getUserSubscriptionStatus(userId)

      return res.render('subscriptions/team/invite-managed', {
        inviterName: invite.inviterName,
        inviteToken: invite.token,
        expired: req.query.expired,
        validationStatus: Object.fromEntries(validationStatus),
        currentManagedUserAdminEmail,
        groupSSOActive,
        subscriptionId: subscription._id.toString(),
        user: sanitizeSessionUserForFrontEnd(sessionUser),
        usersSubscription,
      })
    } else {
      let currentManagedUserAdminEmail
      try {
        currentManagedUserAdminEmail =
          await SubscriptionLocator.promises.getAdminEmail(req.managedBy)
      } catch (err) {
        logger.error({ err }, 'error getting subscription admin email')
      }

      return res.render('subscriptions/team/invite', {
        inviterName: invite.inviterName,
        inviteToken: invite.token,
        hasIndividualPaidSubscription,
        expired: req.query.expired,
        userRestrictions: Array.from(req.userRestrictions || []),
        currentManagedUserAdminEmail,
        groupSSOActive,
        subscriptionId: subscription._id.toString(),
        user: sanitizeSessionUserForFrontEnd(sessionUser),
      })
    }
  } else {
    const userByEmail = await UserGetter.promises.getUserByMainEmail(
      invite.email
    )

    return res.render('subscriptions/team/invite_logged_out', {
      inviterName: invite.inviterName,
      inviteToken: invite.token,
      appName: settings.appName,
      accountExists: userByEmail != null,
      emailAddress: invite.email,
      user: { id: null },
      groupSSOActive,
    })
  }
}

async function viewInvites(req, res, next) {
  const user = SessionManager.getSessionUser(req.session)
  const groupSubscriptions =
    await SubscriptionLocator.promises.getGroupsWithTeamInvitesEmail(user.email)

  const teamInvites = groupSubscriptions.map(groupSubscription =>
    groupSubscription.teamInvites.find(invite => invite.email === user.email)
  )

  return res.render('subscriptions/team/group-invites', {
    teamInvites,
    user,
  })
}

async function acceptInvite(req, res, next) {
  const { token } = req.params
  const userId = SessionManager.getLoggedInUserId(req.session)

  const subscription = await TeamInvitesHandler.promises.acceptInvite(
    token,
    userId,
    req.ip
  )
  const groupSSOActive = (
    await Modules.promises.hooks.fire('hasGroupSSOEnabled', subscription)
  )?.[0]

  try {
    await UserAuditLogHandler.promises.addEntry(
      userId,
      'accept-group-invitation',
      userId,
      req.ip,
      { subscriptionId: subscription._id }
    )
  } catch (e) {
    logger.error(
      { err: e, userId, subscriptionId: subscription._id },
      'error adding audit log entry'
    )
  }

  res.json({ groupSSOActive })
}

function revokeInvite(req, res, next) {
  const subscription = req.entity
  const email = EmailHelper.parseEmail(req.params.email)
  const teamManagerId = SessionManager.getLoggedInUserId(req.session)
  if (!email) {
    return res.sendStatus(400)
  }

  TeamInvitesHandler.revokeInvite(
    teamManagerId,
    subscription,
    email,
    function (err, results) {
      if (err) {
        return next(err)
      }
      res.sendStatus(204)
    }
  )
}

async function resendInvite(req, res, next) {
  const { entity: subscription } = req
  const userEmail = EmailHelper.parseEmail(req.body.email)
  await subscription.populate('admin_id', ['email', 'first_name', 'last_name'])

  if (!userEmail) {
    throw new Error('invalid email')
  }

  const currentInvite = subscription.teamInvites.find(
    invite => invite?.email === userEmail
  )

  if (!currentInvite) {
    return await createInvite(req, res)
  }

  let acceptInviteUrl
  if (subscription.domainCaptureEnabled) {
    const samlInitPath = (
      await Modules.promises.hooks.fire(
        'getGroupSSOInitPath',
        subscription,
        userEmail
      )
    )?.[0]
    acceptInviteUrl = `${settings.siteUrl}${samlInitPath}`
  } else {
    acceptInviteUrl = `${settings.siteUrl}/subscription/invites/${currentInvite.token}/`
  }

  const opts = {
    to: userEmail,
    admin: subscription.admin_id,
    inviter: currentInvite.inviterName,
    acceptInviteUrl,
    reminder: true,
  }

  try {
    await rateLimiters.resendGroupInvite.consume(userEmail, 1, {
      method: 'email',
    })

    const existingUser = await UserGetter.promises.getUserByAnyEmail(userEmail)

    let emailTemplate
    if (subscription.managedUsersEnabled) {
      if (existingUser) {
        emailTemplate = 'verifyEmailToJoinManagedUsers'
      } else {
        emailTemplate = 'inviteNewUserToJoinManagedUsers'
      }
    } else {
      emailTemplate = 'verifyEmailToJoinTeam'
    }

    EmailHandler.sendDeferredEmail(emailTemplate, opts)
  } catch (err) {
    if (err?.remainingPoints === 0) {
      return res.sendStatus(429)
    } else {
      throw OError.tag(err, 'Failed to resend group invite email')
    }
  }

  return res.status(200).json({ success: true })
}

export default {
  createInvite: expressify(createInvite),
  viewInvite: expressify(viewInvite),
  viewInvites: expressify(viewInvites),
  acceptInvite: expressify(acceptInvite),
  revokeInvite,
  resendInvite: expressify(resendInvite),
}
