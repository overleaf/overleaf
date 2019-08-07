/* eslint-disable
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let UserEmailsController
const AuthenticationController = require('../Authentication/AuthenticationController')
const UserGetter = require('./UserGetter')
const UserUpdater = require('./UserUpdater')
const EmailHelper = require('../Helpers/EmailHelper')
const UserEmailsConfirmationHandler = require('./UserEmailsConfirmationHandler')
const { endorseAffiliation } = require('../Institutions/InstitutionsAPI')
const logger = require('logger-sharelatex')
const Errors = require('../Errors/Errors')
const HttpErrors = require('@overleaf/o-error/http')

module.exports = UserEmailsController = {
  list(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    return UserGetter.getUserFullEmails(userId, function(error, fullEmails) {
      if (error != null) {
        return next(error)
      }
      return res.json(fullEmails)
    })
  },

  add(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    const email = EmailHelper.parseEmail(req.body.email)
    if (email == null) {
      return res.sendStatus(422)
    }

    const affiliationOptions = {
      university: req.body.university,
      role: req.body.role,
      department: req.body.department
    }
    return UserUpdater.addEmailAddress(
      userId,
      email,
      affiliationOptions,
      function(error) {
        if (error != null) {
          return UserEmailsController._handleEmailError(error, req, res, next)
        }
        return UserEmailsConfirmationHandler.sendConfirmationEmail(
          userId,
          email,
          function(err) {
            if (error != null) {
              return next(error)
            }
            return res.sendStatus(204)
          }
        )
      }
    )
  },

  remove(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    const email = EmailHelper.parseEmail(req.body.email)
    if (email == null) {
      return res.sendStatus(422)
    }

    return UserUpdater.removeEmailAddress(userId, email, function(error) {
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(200)
    })
  },

  setDefault(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    const email = EmailHelper.parseEmail(req.body.email)
    if (email == null) {
      return res.sendStatus(422)
    }
    UserUpdater.setDefaultEmailAddress(userId, email, err => {
      if (err) {
        return UserEmailsController._handleEmailError(err, req, res, next)
      }
      AuthenticationController.setInSessionUser(req, { email: email })
      res.sendStatus(200)
    })
  },

  endorse(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    const email = EmailHelper.parseEmail(req.body.email)
    if (email == null) {
      return res.sendStatus(422)
    }

    return endorseAffiliation(
      userId,
      email,
      req.body.role,
      req.body.department,
      function(error) {
        if (error != null) {
          return next(error)
        }
        return res.sendStatus(204)
      }
    )
  },

  resendConfirmation(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    const email = EmailHelper.parseEmail(req.body.email)
    if (email == null) {
      return res.sendStatus(422)
    }
    return UserGetter.getUserByAnyEmail(email, { _id: 1 }, function(
      error,
      user
    ) {
      if (error != null) {
        return next(error)
      }
      if (
        user == null ||
        __guard__(user != null ? user._id : undefined, x => x.toString()) !==
          userId
      ) {
        logger.log(
          { userId, email, foundUserId: user != null ? user._id : undefined },
          "email doesn't match logged in user"
        )
        return res.sendStatus(422)
      }
      logger.log({ userId, email }, 'resending email confirmation token')
      return UserEmailsConfirmationHandler.sendConfirmationEmail(
        userId,
        email,
        function(error) {
          if (error != null) {
            return next(error)
          }
          return res.sendStatus(200)
        }
      )
    })
  },

  showConfirm(req, res, next) {
    return res.render('user/confirm_email', {
      token: req.query.token,
      title: 'confirm_email'
    })
  },

  confirm(req, res, next) {
    const { token } = req.body
    if (token == null) {
      return res.sendStatus(422)
    }
    return UserEmailsConfirmationHandler.confirmEmailFromToken(token, function(
      error
    ) {
      if (error != null) {
        if (error instanceof Errors.NotFoundError) {
          return res.status(404).json({
            message:
              'Sorry, your confirmation token is invalid or has expired. Please request a new email confirmation link.'
          })
        } else {
          return next(error)
        }
      } else {
        return res.sendStatus(200)
      }
    })
  },

  _handleEmailError(error, req, res, next) {
    if (error instanceof Errors.UnconfirmedEmailError) {
      return next(
        new HttpErrors.ConflictError({
          info: {
            public: { message: 'email must be confirmed' }
          }
        }).withCause(error)
      )
    } else if (error instanceof Errors.EmailExistsError) {
      return next(
        new HttpErrors.ConflictError({
          info: {
            public: { message: req.i18n.translate('email_already_registered') }
          }
        }).withCause(error)
      )
    }
    next(new HttpErrors.InternalServerError().withCause(error))
  }
}
function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
