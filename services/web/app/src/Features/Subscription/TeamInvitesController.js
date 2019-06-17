/* eslint-disable
    max-len,
    no-undef,
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
const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const TeamInvitesHandler = require('./TeamInvitesHandler')
const AuthenticationController = require('../Authentication/AuthenticationController')
const SubscriptionLocator = require('./SubscriptionLocator')
const ErrorController = require('../Errors/ErrorController')
const EmailHelper = require('../Helpers/EmailHelper')

module.exports = {
  createInvite(req, res, next) {
    const teamManagerId = AuthenticationController.getLoggedInUserId(req)
    const subscription = req.entity
    const email = EmailHelper.parseEmail(req.body.email)
    if (email == null) {
      return res.status(422).json({
        error: {
          code: 'invalid_email',
          message: req.i18n.translate('invalid_email')
        }
      })
    }

    return TeamInvitesHandler.createInvite(
      teamManagerId,
      subscription,
      email,
      function(err, inviteUserData) {
        if (err != null) {
          return next(err)
        }
        return res.json({ user: inviteUserData })
      }
    )
  },

  viewInvite(req, res, next) {
    const { token } = req.params
    const userId = AuthenticationController.getLoggedInUserId(req)

    return TeamInvitesHandler.getInvite(token, function(
      err,
      invite,
      teamSubscription
    ) {
      if (err != null) {
        return next(err)
      }

      if (!invite) {
        return ErrorController.notFound(req, res, next)
      }

      return SubscriptionLocator.getUsersSubscription(userId, function(
        err,
        personalSubscription
      ) {
        if (err != null) {
          return next(err)
        }

        const hasIndividualRecurlySubscription =
          personalSubscription != null &&
          personalSubscription.planCode.match(/(free|trial)/) == null &&
          personalSubscription.groupPlan === false &&
          personalSubscription.recurlySubscription_id != null &&
          personalSubscription.recurlySubscription_id !== ''

        return res.render('subscriptions/team/invite', {
          inviterName: invite.inviterName,
          inviteToken: invite.token,
          hasIndividualRecurlySubscription,
          appName: settings.appName
        })
      })
    })
  },

  acceptInvite(req, res, next) {
    const { token } = req.params
    const userId = AuthenticationController.getLoggedInUserId(req)

    return TeamInvitesHandler.acceptInvite(token, userId, function(
      err,
      results
    ) {
      if (err != null) {
        return next(err)
      }
      return res.sendStatus(204)
    })
  },

  revokeInvite(req, res) {
    const subscription = req.entity
    const email = EmailHelper.parseEmail(req.params.email)
    const teamManagerId = AuthenticationController.getLoggedInUserId(req)
    if (email == null) {
      return res.sendStatus(400)
    }

    return TeamInvitesHandler.revokeInvite(
      teamManagerId,
      subscription,
      email,
      function(err, results) {
        if (err != null) {
          return next(err)
        }
        return res.sendStatus(204)
      }
    )
  }
}
