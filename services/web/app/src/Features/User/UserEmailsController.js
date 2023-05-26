const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const SessionManager = require('../Authentication/SessionManager')
const UserGetter = require('./UserGetter')
const UserUpdater = require('./UserUpdater')
const UserSessionsManager = require('./UserSessionsManager')
const EmailHandler = require('../Email/EmailHandler')
const EmailHelper = require('../Helpers/EmailHelper')
const UserEmailsConfirmationHandler = require('./UserEmailsConfirmationHandler')
const { endorseAffiliation } = require('../Institutions/InstitutionsAPI')
const Errors = require('../Errors/Errors')
const HttpErrorHandler = require('../Errors/HttpErrorHandler')
const { expressify } = require('../../util/promises')
const AsyncFormHelper = require('../Helpers/AsyncFormHelper')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const UserPrimaryEmailCheckHandler = require('../User/UserPrimaryEmailCheckHandler')

async function _sendSecurityAlertEmail(user, email) {
  const emailOptions = {
    to: user.email,
    actionDescribed: `a secondary email address has been added to your account ${user.email}`,
    message: [
      `<span style="display:inline-block;padding: 0 20px;width:100%;">Added: <br/><b>${email}</b></span>`,
    ],
    action: 'secondary email address added',
  }
  await EmailHandler.promises.sendEmail('securityAlert', emailOptions)
}

async function add(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const email = EmailHelper.parseEmail(req.body.email)
  if (!email) {
    return res.sendStatus(422)
  }
  const user = await UserGetter.promises.getUser(userId, {
    email: 1,
    'emails.email': 1,
  })

  if (user.emails.length >= Settings.emailAddressLimit) {
    return res.status(422).json({ message: 'secondary email limit exceeded' })
  }

  const affiliationOptions = {
    university: req.body.university,
    role: req.body.role,
    department: req.body.department,
  }

  try {
    await UserUpdater.promises.addEmailAddress(
      userId,
      email,
      affiliationOptions,
      {
        initiatorId: user._id,
        ipAddress: req.ip,
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
  const userId = SessionManager.getLoggedInUserId(req.session)
  const email = EmailHelper.parseEmail(req.body.email)
  if (!email) {
    return res.sendStatus(422)
  }
  UserGetter.getUserByAnyEmail(email, { _id: 1 }, function (error, user) {
    if (error) {
      return next(error)
    }
    if (!user || user._id.toString() !== userId) {
      return res.sendStatus(422)
    }
    UserEmailsConfirmationHandler.sendConfirmationEmail(
      userId,
      email,
      function (error) {
        if (error) {
          return next(error)
        }
        res.sendStatus(200)
      }
    )
  })
}

function sendReconfirmation(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const email = EmailHelper.parseEmail(req.body.email)
  if (!email) {
    return res.sendStatus(400)
  }
  UserGetter.getUserByAnyEmail(email, { _id: 1 }, function (error, user) {
    if (error) {
      return next(error)
    }
    if (!user || user._id.toString() !== userId) {
      return res.sendStatus(422)
    }
    UserEmailsConfirmationHandler.sendReconfirmationEmail(
      userId,
      email,
      function (error) {
        if (error) {
          return next(error)
        }
        res.sendStatus(204)
      }
    )
  })
}

async function primaryEmailCheckPage(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const user = await UserGetter.promises.getUser(userId, {
    lastPrimaryEmailCheck: 1,
    signUpDate: 1,
    email: 1,
    emails: 1,
  })

  if (!UserPrimaryEmailCheckHandler.requiresPrimaryEmailCheck(user)) {
    return res.redirect('/project')
  }

  AnalyticsManager.recordEventForUser(
    userId,
    'primary-email-check-page-displayed'
  )
  res.render('user/primaryEmailCheck')
}

async function primaryEmailCheck(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  await UserUpdater.promises.updateUser(userId, {
    $set: { lastPrimaryEmailCheck: new Date() },
  })
  AnalyticsManager.recordEventForUser(userId, 'primary-email-check-done')
  AsyncFormHelper.redirect(req, res, '/project')
}

const UserEmailsController = {
  list(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    UserGetter.getUserFullEmails(userId, function (error, fullEmails) {
      if (error) {
        return next(error)
      }
      res.json(fullEmails)
    })
  },

  add: expressify(add),

  remove(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const email = EmailHelper.parseEmail(req.body.email)
    if (!email) {
      return res.sendStatus(422)
    }
    const auditLog = {
      initiatorId: userId,
      ipAddress: req.ip,
    }
    UserUpdater.removeEmailAddress(userId, email, auditLog, function (error) {
      if (error) {
        return next(error)
      }
      res.sendStatus(200)
    })
  },

  setDefault(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const email = EmailHelper.parseEmail(req.body.email)
    if (!email) {
      return res.sendStatus(422)
    }
    const auditLog = {
      initiatorId: userId,
      ipAddress: req.ip,
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
        SessionManager.setInSessionUser(req.session, { email })
        const user = SessionManager.getSessionUser(req.session)
        UserSessionsManager.revokeAllUserSessions(
          user,
          [req.sessionID],
          err => {
            if (err)
              logger.warn(
                { err },
                'failed revoking secondary sessions after changing default email'
              )
          }
        )
        res.sendStatus(200)
      }
    )
  },

  endorse(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const email = EmailHelper.parseEmail(req.body.email)
    if (!email) {
      return res.sendStatus(422)
    }

    endorseAffiliation(
      userId,
      email,
      req.body.role,
      req.body.department,
      function (error) {
        if (error) {
          return next(error)
        }
        res.sendStatus(204)
      }
    )
  },

  resendConfirmation,

  sendReconfirmation,

  primaryEmailCheckPage: expressify(primaryEmailCheckPage),

  primaryEmailCheck: expressify(primaryEmailCheck),

  showConfirm(req, res, next) {
    res.render('user/confirm_email', {
      token: req.query.token,
      title: 'confirm_email',
    })
  },

  confirm(req, res, next) {
    const { token } = req.body
    if (!token) {
      return res.status(422).json({
        message: req.i18n.translate('confirmation_link_broken'),
      })
    }
    UserEmailsConfirmationHandler.confirmEmailFromToken(
      token,
      function (error) {
        if (error) {
          if (error instanceof Errors.NotFoundError) {
            res.status(404).json({
              message: req.i18n.translate('confirmation_token_invalid'),
            })
          } else {
            next(error)
          }
        } else {
          res.sendStatus(200)
        }
      }
    )
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
  },
}

module.exports = UserEmailsController
