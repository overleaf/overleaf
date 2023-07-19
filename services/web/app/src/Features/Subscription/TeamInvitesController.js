const settings = require('@overleaf/settings')
const TeamInvitesHandler = require('./TeamInvitesHandler')
const SessionManager = require('../Authentication/SessionManager')
const SubscriptionLocator = require('./SubscriptionLocator')
const ErrorController = require('../Errors/ErrorController')
const EmailHelper = require('../Helpers/EmailHelper')
const UserGetter = require('../User/UserGetter')
const { expressify } = require('../../util/promises')
const HttpErrorHandler = require('../Errors/HttpErrorHandler')
const PermissionsManager = require('../Authorization/PermissionsManager')

function createInvite(req, res, next) {
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

  TeamInvitesHandler.createInvite(
    teamManagerId,
    subscription,
    email,
    function (err, inviteUserData) {
      if (err) {
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
        return next(err)
      }
      res.json({ user: inviteUserData })
    }
  )
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

    if (subscription?.groupPolicy) {
      if (!subscription.populated('groupPolicy')) {
        await subscription.populate('groupPolicy')
      }

      const user = await UserGetter.promises.getUser(userId)

      if (
        user.enrollment?.managedBy &&
        user.enrollment?.managedBy.toString() !== subscription._id.toString()
      ) {
        return HttpErrorHandler.forbidden(
          req,
          res,
          'User is already managed by a different subscription'
        )
      }

      validationStatus =
        await PermissionsManager.promises.getUserValidationStatus(
          user,
          subscription.groupPolicy,
          subscription
        )

      return res.render('subscriptions/team/invite-managed', {
        inviterName: invite.inviterName,
        inviteToken: invite.token,
        expired: req.query.expired,
        validationStatus: Object.fromEntries(validationStatus),
      })
    } else {
      return res.render('subscriptions/team/invite', {
        inviterName: invite.inviterName,
        inviteToken: invite.token,
        hasIndividualRecurlySubscription,
        appName: settings.appName,
        expired: req.query.expired,
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

  await TeamInvitesHandler.promises.acceptInvite(token, userId)
  res.sendStatus(204)
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

module.exports = {
  createInvite,
  viewInvite: expressify(viewInvite),
  acceptInvite: expressify(acceptInvite),
  revokeInvite,
}
