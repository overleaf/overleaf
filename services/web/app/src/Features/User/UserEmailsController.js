let UserEmailsController
const AuthenticationController = require('../Authentication/AuthenticationController')
const UserGetter = require('./UserGetter')
const UserUpdater = require('./UserUpdater')
const EmailHelper = require('../Helpers/EmailHelper')
const UserEmailsConfirmationHandler = require('./UserEmailsConfirmationHandler')
const { endorseAffiliation } = require('../Institutions/InstitutionsAPI')
const Errors = require('../Errors/Errors')
const HttpErrors = require('@overleaf/o-error/http')

function add(req, res, next) {
  const userId = AuthenticationController.getLoggedInUserId(req)
  const email = EmailHelper.parseEmail(req.body.email)
  if (!email) {
    return res.sendStatus(422)
  }

  const affiliationOptions = {
    university: req.body.university,
    role: req.body.role,
    department: req.body.department
  }
  UserUpdater.addEmailAddress(userId, email, affiliationOptions, function(
    error
  ) {
    if (error) {
      return UserEmailsController._handleEmailError(error, req, res, next)
    }
    UserEmailsConfirmationHandler.sendConfirmationEmail(userId, email, function(
      error
    ) {
      if (error) {
        return next(error)
      }
      res.sendStatus(204)
    })
  })
}

function resendConfirmation(req, res, next) {
  const userId = AuthenticationController.getLoggedInUserId(req)
  const email = EmailHelper.parseEmail(req.body.email)
  if (!email) {
    return res.sendStatus(422)
  }
  UserGetter.getUserByAnyEmail(email, { _id: 1 }, function(error, user) {
    if (error) {
      return next(error)
    }
    if (!user || user._id.toString() !== userId) {
      return res.sendStatus(422)
    }
    UserEmailsConfirmationHandler.sendConfirmationEmail(userId, email, function(
      error
    ) {
      if (error) {
        return next(error)
      }
      res.sendStatus(200)
    })
  })
}

module.exports = UserEmailsController = {
  list(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    UserGetter.getUserFullEmails(userId, function(error, fullEmails) {
      if (error) {
        return next(error)
      }
      res.json(fullEmails)
    })
  },

  add,

  remove(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    const email = EmailHelper.parseEmail(req.body.email)
    if (!email) {
      return res.sendStatus(422)
    }

    UserUpdater.removeEmailAddress(userId, email, function(error) {
      if (error) {
        return next(error)
      }
      res.sendStatus(200)
    })
  },

  setDefault(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    const email = EmailHelper.parseEmail(req.body.email)
    if (!email) {
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
    if (!email) {
      return res.sendStatus(422)
    }

    endorseAffiliation(
      userId,
      email,
      req.body.role,
      req.body.department,
      function(error) {
        if (error) {
          return next(error)
        }
        res.sendStatus(204)
      }
    )
  },

  resendConfirmation,

  showConfirm(req, res, next) {
    res.render('user/confirm_email', {
      token: req.query.token,
      title: 'confirm_email'
    })
  },

  confirm(req, res, next) {
    const { token } = req.body
    if (!token) {
      return res.status(422).json({
        message: req.i18n.translate('confirmation_link_broken')
      })
    }
    UserEmailsConfirmationHandler.confirmEmailFromToken(token, function(error) {
      if (error) {
        if (error instanceof Errors.NotFoundError) {
          res.status(404).json({
            message: req.i18n.translate('confirmation_token_invalid')
          })
        } else {
          next(error)
        }
      } else {
        res.sendStatus(200)
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
