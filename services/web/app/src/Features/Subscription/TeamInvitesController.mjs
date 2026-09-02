import crypto from 'node:crypto'
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
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 * @typedef {import('express').NextFunction} NextFunction
 */

const rateLimiters = {
  resendGroupInvite: new RateLimiter('resend-group-invite', {
    points: 1,
    duration: 60 * 60,
  }),
}

// non-strict: evidence of scripts interacting with this that harmlessly send
// extra, ignored fields, see https://github.com/overleaf/internal/issues/36577
const createInviteSchema = z.object({
  body: z.object({
    email: z.string(),
  }),
})

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
async function createInvite(req, res, next) {
  const { body } = parseReq(req, createInviteSchema, { logOnly: true })
  const teamManagerId = SessionManager.getLoggedInUserId(req.session)
  const subscription = req.entity
  const email = EmailHelper.parseEmail(body.email)
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

const viewInviteSchema = z.object({
  params: z.strictObject({
    token: z.string(),
  }),
  query: z.object({
    // rendered verbatim into a `data-type='boolean'` meta tag (Pug
    // auto-escapes); the frontend, not this handler, interprets it as a
    // boolean, so it is not constrained to z.stringbool() here.
    expired: z.string().optional(),
  }),
})

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
async function viewInvite(req, res, next) {
  const { params, query } = parseReq(req, viewInviteSchema, {
    logOnly: true,
  })
  const { token } = params
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
        expired: query.expired,
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
        expired: query.expired,
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

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
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

const acceptInviteSchema = z.object({
  params: z.strictObject({
    token: z.string(),
  }),
})

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
async function acceptInvite(req, res, next) {
  const { params } = parseReq(req, acceptInviteSchema, { logOnly: true })
  const { token } = params
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

const revokeInviteSchema = z.object({
  // mounted at /manage/groups/:id/invites/:email -- `id` is consumed
  // upstream by UserMembershipMiddleware.requireGroupMemberManagement()
  // (which sets req.entity), but it's still present on req.params, so the
  // strict schema below has to name it too.
  params: z.strictObject({
    id: zz.objectId(),
    email: z.string(),
  }),
})

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
function revokeInvite(req, res, next) {
  const { params } = parseReq(req, revokeInviteSchema, { logOnly: true })
  const subscription = req.entity
  const email = EmailHelper.parseEmail(params.email)
  const teamManagerId = SessionManager.getLoggedInUserId(req.session)
  if (!email) {
    return res.sendStatus(400)
  }

  TeamInvitesHandler.revokeInvite(
    teamManagerId,
    subscription,
    email,
    /**
     * @param {any} err
     * @param {any} results
     */
    function (err, results) {
      if (err) {
        return next(err)
      }
      res.sendStatus(204)
    }
  )
}

const resendInviteSchema = z.object({
  body: z.strictObject({
    email: z.string(),
  }),
})

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
async function resendInvite(req, res, next) {
  const { body } = parseReq(req, resendInviteSchema, { logOnly: true })
  const { entity: subscription } = req
  const userEmail = EmailHelper.parseEmail(body.email)
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
    if (!currentInvite.token) {
      currentInvite.token = crypto.randomBytes(32).toString('hex')
      currentInvite.domainCapture = false
      await subscription.save()
    }
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
