const settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const OError = require('@overleaf/o-error')
const TeamInvitesHandler = require('./TeamInvitesHandler')
const SessionManager = require('../Authentication/SessionManager')
const SubscriptionLocator = require('./SubscriptionLocator')
const ErrorController = require('../Errors/ErrorController')
const EmailHelper = require('../Helpers/EmailHelper')
const UserGetter = require('../User/UserGetter')
const { expressify } = require('@overleaf/promise-utils')
const HttpErrorHandler = require('../Errors/HttpErrorHandler')
const PermissionsManager = require('../Authorization/PermissionsManager')
const EmailHandler = require('../Email/EmailHandler')
const { RateLimiter } = require('../../infrastructure/RateLimiter')
const Modules = require('../../infrastructure/Modules')

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
    const invitedUserData = await TeamInvitesHandler.promises.createInvite(
      teamManagerId,
      subscription,
      email
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
  const userId = SessionManager.getLoggedInUserId(req.session)

  const { invite, subscription } = await TeamInvitesHandler.promises.getInvite(
    token
  )
  if (!invite) {
    return ErrorController.notFound(req, res)
  }

  let validationStatus = new Map()
  if (userId) {
    const personalSubscription =
      await SubscriptionLocator.promises.getUsersSubscription(userId)

    const hasIndividualRecurlySubscription =
      personalSubscription &&
      personalSubscription.groupPlan === false &&
      personalSubscription.recurlyStatus?.state !== 'canceled' &&
      personalSubscription.recurlySubscription_id &&
      personalSubscription.recurlySubscription_id !== ''

    const groupSSOActive = await SubscriptionLocator.promises.hasSSOEnabled(
      subscription
    )

    if (subscription?.groupPolicy) {
      if (!subscription.populated('groupPolicy')) {
        await subscription.populate('groupPolicy')
      }

      const user = await UserGetter.promises.getUser(userId)

      const isUserEnrolledInDifferentGroup =
        (
          await Modules.promises.hooks.fire(
            'isUserEnrolledInDifferentGroup',
            user.enrollment,
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
          user,
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

      return res.render('subscriptions/team/invite-managed', {
        inviterName: invite.inviterName,
        inviteToken: invite.token,
        expired: req.query.expired,
        validationStatus: Object.fromEntries(validationStatus),
        currentManagedUserAdminEmail,
        groupSSOActive,
        subscriptionId: subscription._id.toString(),
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
        hasIndividualRecurlySubscription,
        appName: settings.appName,
        expired: req.query.expired,
        userRestrictions: Array.from(req.userRestrictions || []),
        currentManagedUserAdminEmail,
        groupSSOActive,
        subscriptionId: subscription._id.toString(),
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
    })
  }
}

async function acceptInvite(req, res, next) {
  const { token } = req.params
  const userId = SessionManager.getLoggedInUserId(req.session)

  const subscription = await TeamInvitesHandler.promises.acceptInvite(
    token,
    userId
  )
  const groupSSOActive = await SubscriptionLocator.promises.hasSSOEnabled(
    subscription
  )

  res.status(204).json({ groupSSOActive })
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

  const opts = {
    to: userEmail,
    admin: subscription.admin_id,
    inviter: currentInvite.inviterName,
    acceptInviteUrl: `${settings.siteUrl}/subscription/invites/${currentInvite.token}/`,
    reminder: true,
  }

  try {
    await rateLimiters.resendGroupInvite.consume(userEmail)

    const existingUser = await UserGetter.promises.getUserByAnyEmail(userEmail)
    const emailTemplate = existingUser
      ? 'verifyEmailToJoinManagedUsers'
      : 'inviteNewUserToJoinManagedUsers'

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

module.exports = {
  createInvite: expressify(createInvite),
  viewInvite: expressify(viewInvite),
  acceptInvite: expressify(acceptInvite),
  revokeInvite,
  resendInvite: expressify(resendInvite),
}
