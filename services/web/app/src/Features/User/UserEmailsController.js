const AuthenticationController = require('../Authentication/AuthenticationController')
const UserGetter = require('./UserGetter')
const UserUpdater = require('./UserUpdater')
const EmailHandler = require('../Email/EmailHandler')
const EmailHelper = require('../Helpers/EmailHelper')
const UserEmailsConfirmationHandler = require('./UserEmailsConfirmationHandler')
const { endorseAffiliation } = require('../Institutions/InstitutionsAPI')
const Errors = require('../Errors/Errors')
const HttpErrorHandler = require('../Errors/HttpErrorHandler')
const { expressify } = require('../../util/promises')

async function _sendSecurityAlertEmail(user, email) {
  const emailOptions = {
    to: user.email,
    actionDescribed: `a secondary email address has been added to your account ${
      user.email
    }`,
    message: [
      `<span style="display:inline-block;padding: 0 20px;width:100%;">Added: <br/><b>${email}</b></span>`
    ],
    action: 'secondary email address added'
  }
  await EmailHandler.promises.sendEmail('securityAlert', emailOptions)
}

async function add(req, res, next) {
  const userId = AuthenticationController.getLoggedInUserId(req)
  const email = EmailHelper.parseEmail(req.body.email)
  if (!email) {
    return res.sendStatus(422)
  }
  const user = await UserGetter.promises.getUser(userId, { email: 1 })

  const affiliationOptions = {
    university: req.body.university,
    role: req.body.role,
    department: req.body.department
  }

  try {
    await UserUpdater.promises.addEmailAddress(
      userId,
      email,
      affiliationOptions,
      {
        initiatorId: user._id,
        ipAddress: req.ip
      }
    )
  } catch (error) {
    return UserEmailsController._handleEmailError(error, req, res, next)
  }

  await _sendSecurityAlertEmail(user, email)

  await UserEmailsConfirmationHandler.promises.sendConfirmationEmail(
    userId,
    email
  )

  res.sendStatus(204)
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

const UserEmailsController = {
  list(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    UserGetter.getUserFullEmails(userId, function(error, fullEmails) {
      if (error) {
        return next(error)
      }
      res.json(fullEmails)
    })
  },

  add: expressify(add),

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
    const auditLog = {
      initiatorId: userId,
      ipAddress: req.ip
    }
    UserUpdater.setDefaultEmailAddress(
      userId,
      email,
      false,
      auditLog,
      true,
      err => {
        if (err) {
          return UserEmailsController._handleEmailError(err, req, res, next)
        }
        AuthenticationController.setInSessionUser(req, { email: email })
        res.sendStatus(200)
      }
    )
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
      return HttpErrorHandler.conflict(req, res, 'email must be confirmed')
    } else if (error instanceof Errors.EmailExistsError) {
      const message = req.i18n.translate('email_already_registered')
      return HttpErrorHandler.conflict(req, res, message)
    } else if (error.message === '422: Email does not belong to university') {
      const message = req.i18n.translate('email_does_not_belong_to_university')
      return HttpErrorHandler.conflict(req, res, message)
    }
    next(error)
  }
}

module.exports = UserEmailsController
