const settings = require('@overleaf/settings')
const TeamInvitesHandler = require('./TeamInvitesHandler')
const SessionManager = require('../Authentication/SessionManager')
const SubscriptionLocator = require('./SubscriptionLocator')
const ErrorController = require('../Errors/ErrorController')
const EmailHelper = require('../Helpers/EmailHelper')

module.exports = {
  createInvite(req, res, next) {
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
  },

  viewInvite(req, res, next) {
    const { token } = req.params
    const userId = SessionManager.getLoggedInUserId(req.session)

    TeamInvitesHandler.getInvite(
      token,
      function (err, invite, teamSubscription) {
        if (err) {
          return next(err)
        }

        if (!invite) {
          return ErrorController.notFound(req, res, next)
        }

        SubscriptionLocator.getUsersSubscription(
          userId,
          function (err, personalSubscription) {
            if (err) {
              return next(err)
            }

            const hasIndividualRecurlySubscription =
              personalSubscription &&
              personalSubscription.groupPlan === false &&
              personalSubscription.recurlyStatus?.state !== 'canceled' &&
              personalSubscription.recurlySubscription_id &&
              personalSubscription.recurlySubscription_id !== ''

            res.render('subscriptions/team/invite', {
              inviterName: invite.inviterName,
              inviteToken: invite.token,
              hasIndividualRecurlySubscription,
              appName: settings.appName,
              expired: req.query.expired,
            })
          }
        )
      }
    )
  },

  acceptInvite(req, res, next) {
    const { token } = req.params
    const userId = SessionManager.getLoggedInUserId(req.session)

    TeamInvitesHandler.acceptInvite(token, userId, function (err, results) {
      if (err) {
        return next(err)
      }
      res.sendStatus(204)
    })
  },

  revokeInvite(req, res, next) {
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
  },
}
