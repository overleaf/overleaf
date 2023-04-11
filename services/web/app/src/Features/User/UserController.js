const UserHandler = require('./UserHandler')
const UserDeleter = require('./UserDeleter')
const UserGetter = require('./UserGetter')
const { User } = require('../../models/User')
const NewsletterManager = require('../Newsletter/NewsletterManager')
const logger = require('@overleaf/logger')
const metrics = require('@overleaf/metrics')
const AuthenticationManager = require('../Authentication/AuthenticationManager')
const SessionManager = require('../Authentication/SessionManager')
const Features = require('../../infrastructure/Features')
const UserAuditLogHandler = require('./UserAuditLogHandler')
const UserSessionsManager = require('./UserSessionsManager')
const UserUpdater = require('./UserUpdater')
const Errors = require('../Errors/Errors')
const HttpErrorHandler = require('../Errors/HttpErrorHandler')
const OError = require('@overleaf/o-error')
const EmailHandler = require('../Email/EmailHandler')
const UrlHelper = require('../Helpers/UrlHelper')
const { promisify } = require('util')
const { expressify } = require('../../util/promises')
const {
  acceptsJson,
} = require('../../infrastructure/RequestContentTypeDetection')
const Modules = require('../../infrastructure/Modules')

async function _sendSecurityAlertClearedSessions(user) {
  const emailOptions = {
    to: user.email,
    actionDescribed: `active sessions were cleared on your account ${user.email}`,
    action: 'active sessions cleared',
  }
  try {
    await EmailHandler.promises.sendEmail('securityAlert', emailOptions)
  } catch (error) {
    // log error when sending security alert email but do not pass back
    logger.error(
      { error, userId: user._id },
      'could not send security alert email when sessions cleared'
    )
  }
}

function _sendSecurityAlertPasswordChanged(user) {
  const emailOptions = {
    to: user.email,
    actionDescribed: `your password has been changed on your account ${user.email}`,
    action: 'password changed',
  }
  EmailHandler.sendEmail('securityAlert', emailOptions, error => {
    if (error) {
      // log error when sending security alert email but do not pass back
      logger.error(
        { error, userId: user._id },
        'could not send security alert email when password changed'
      )
    }
  })
}

async function _ensureAffiliation(userId, emailData) {
  if (emailData.samlProviderId) {
    await UserUpdater.promises.confirmEmail(userId, emailData.email)
  } else {
    await UserUpdater.promises.addAffiliationForNewUser(userId, emailData.email)
  }
}

async function changePassword(req, res, next) {
  metrics.inc('user.password-change')
  const userId = SessionManager.getLoggedInUserId(req.session)

  const user = await AuthenticationManager.promises.authenticate(
    { _id: userId },
    req.body.currentPassword
  )
  if (!user) {
    return HttpErrorHandler.badRequest(
      req,
      res,
      req.i18n.translate('password_change_old_password_wrong')
    )
  }

  if (req.body.newPassword1 !== req.body.newPassword2) {
    return HttpErrorHandler.badRequest(
      req,
      res,
      req.i18n.translate('password_change_passwords_do_not_match')
    )
  }

  try {
    await AuthenticationManager.promises.setUserPassword(
      user,
      req.body.newPassword1
    )
  } catch (error) {
    if (error.name === 'InvalidPasswordError') {
      const message = AuthenticationManager.getMessageForInvalidPasswordError(
        error,
        req
      )
      return res.status(400).json({ message })
    } else if (error.name === 'PasswordMustBeDifferentError') {
      return HttpErrorHandler.badRequest(
        req,
        res,
        req.i18n.translate('password_change_password_must_be_different')
      )
    } else if (error.name === 'PasswordReusedError') {
      return res.status(400).json({
        message: {
          key: 'password-must-be-strong',
        },
      })
    } else {
      throw error
    }
  }
  await UserAuditLogHandler.promises.addEntry(
    user._id,
    'update-password',
    user._id,
    req.ip
  )

  // no need to wait, errors are logged and not passed back
  _sendSecurityAlertPasswordChanged(user)

  await UserSessionsManager.promises.revokeAllUserSessions(user, [
    req.sessionID,
  ])

  return res.json({
    message: {
      type: 'success',
      email: user.email,
      text: req.i18n.translate('password_change_successful'),
    },
  })
}

async function clearSessions(req, res, next) {
  metrics.inc('user.clear-sessions')
  const userId = SessionManager.getLoggedInUserId(req.session)
  const user = await UserGetter.promises.getUser(userId, { email: 1 })
  const sessions = await UserSessionsManager.promises.getAllUserSessions(user, [
    req.sessionID,
  ])
  await UserAuditLogHandler.promises.addEntry(
    user._id,
    'clear-sessions',
    user._id,
    req.ip,
    { sessions }
  )
  await UserSessionsManager.promises.revokeAllUserSessions(user, [
    req.sessionID,
  ])

  await _sendSecurityAlertClearedSessions(user)

  res.sendStatus(201)
}

async function ensureAffiliation(user) {
  if (!Features.hasFeature('affiliations')) {
    return
  }

  const flaggedEmails = user.emails.filter(email => email.affiliationUnchecked)
  if (flaggedEmails.length === 0) {
    return
  }

  if (flaggedEmails.length > 1) {
    logger.error(
      { userId: user._id },
      `Unexpected number of flagged emails: ${flaggedEmails.length}`
    )
  }

  await _ensureAffiliation(user._id, flaggedEmails[0])
}

async function ensureAffiliationMiddleware(req, res, next) {
  let user
  if (!Features.hasFeature('affiliations') || !req.query.ensureAffiliation) {
    return next()
  }
  const userId = SessionManager.getLoggedInUserId(req.session)
  try {
    user = await UserGetter.promises.getUser(userId)
  } catch (error) {
    return new Errors.UserNotFoundError({ info: { userId } })
  }
  try {
    await ensureAffiliation(user)
  } catch (error) {
    return next(error)
  }
  return next()
}

const UserController = {
  clearSessions: expressify(clearSessions),

  tryDeleteUser(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const { password } = req.body

    if (password == null || password === '') {
      logger.err(
        { userId },
        'no password supplied for attempt to delete account'
      )
      return res.sendStatus(403)
    }
    AuthenticationManager.authenticate(
      { _id: userId },
      password,
      (err, user) => {
        if (err != null) {
          OError.tag(
            err,
            'error authenticating during attempt to delete account',
            {
              userId,
            }
          )
          return next(err)
        }
        if (!user) {
          logger.err({ userId }, 'auth failed during attempt to delete account')
          return res.sendStatus(403)
        }
        UserDeleter.deleteUser(
          userId,
          { deleterUser: user, ipAddress: req.ip },
          err => {
            if (err) {
              const errorData = {
                message: 'error while deleting user account',
                info: { userId },
              }
              if (err instanceof Errors.SubscriptionAdminDeletionError) {
                // set info.public.error for JSON response so frontend can display
                // a specific message
                errorData.info.public = {
                  error: 'SubscriptionAdminDeletionError',
                }
                logger.warn(OError.tag(err, errorData.message, errorData.info))
                return HttpErrorHandler.unprocessableEntity(
                  req,
                  res,
                  errorData.message,
                  errorData.info.public
                )
              } else {
                return next(OError.tag(err, errorData.message, errorData.info))
              }
            }
            const sessionId = req.sessionID
            if (typeof req.logout === 'function') {
              req.logout()
            }
            req.session.destroy(err => {
              if (err != null) {
                OError.tag(err, 'error destroying session')
                return next(err)
              }
              UserSessionsManager.untrackSession(user, sessionId, () => {})
              res.sendStatus(200)
            })
          }
        )
      }
    )
  },

  subscribe(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    UserGetter.getUser(userId, (err, user) => {
      if (err != null) {
        return next(err)
      }
      NewsletterManager.subscribe(user, err => {
        if (err != null) {
          OError.tag(err, 'error subscribing to newsletter')
          return next(err)
        }
        return res.json({
          message: req.i18n.translate('thanks_settings_updated'),
        })
      })
    })
  },

  unsubscribe(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    UserGetter.getUser(userId, (err, user) => {
      if (err != null) {
        return next(err)
      }
      NewsletterManager.unsubscribe(user, err => {
        if (err != null) {
          OError.tag(err, 'error unsubscribing to newsletter')
          return next(err)
        }
        Modules.hooks.fire('newsletterUnsubscribed', user, err => {
          if (err) {
            OError.tag(err, 'error firing "newsletterUnsubscribed" hook')
            return next(err)
          }
          return res.json({
            message: req.i18n.translate('thanks_settings_updated'),
          })
        })
      })
    })
  },

  updateUserSettings(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    User.findById(userId, (err, user) => {
      if (err != null || user == null) {
        logger.err({ err, userId }, 'problem updaing user settings')
        return res.sendStatus(500)
      }

      if (req.body.first_name != null) {
        user.first_name = req.body.first_name.trim()
      }
      if (req.body.last_name != null) {
        user.last_name = req.body.last_name.trim()
      }
      if (req.body.role != null) {
        user.role = req.body.role.trim()
      }
      if (req.body.institution != null) {
        user.institution = req.body.institution.trim()
      }
      if (req.body.mode != null) {
        user.ace.mode = req.body.mode
      }
      if (req.body.editorTheme != null) {
        user.ace.theme = req.body.editorTheme
      }
      if (req.body.overallTheme != null) {
        user.ace.overallTheme = req.body.overallTheme
      }
      if (req.body.fontSize != null) {
        user.ace.fontSize = req.body.fontSize
      }
      if (req.body.autoComplete != null) {
        user.ace.autoComplete = req.body.autoComplete
      }
      if (req.body.autoPairDelimiters != null) {
        user.ace.autoPairDelimiters = req.body.autoPairDelimiters
      }
      if (req.body.spellCheckLanguage != null) {
        user.ace.spellCheckLanguage = req.body.spellCheckLanguage
      }
      if (req.body.pdfViewer != null) {
        user.ace.pdfViewer = req.body.pdfViewer
      }
      if (req.body.syntaxValidation != null) {
        user.ace.syntaxValidation = req.body.syntaxValidation
      }
      if (req.body.fontFamily != null) {
        user.ace.fontFamily = req.body.fontFamily
      }
      if (req.body.lineHeight != null) {
        user.ace.lineHeight = req.body.lineHeight
      }

      user.save(err => {
        if (err != null) {
          return next(err)
        }
        const newEmail =
          req.body.email != null
            ? req.body.email.trim().toLowerCase()
            : undefined
        if (
          newEmail == null ||
          newEmail === user.email ||
          req.externalAuthenticationSystemUsed()
        ) {
          // end here, don't update email
          SessionManager.setInSessionUser(req.session, {
            first_name: user.first_name,
            last_name: user.last_name,
          })
          res.sendStatus(200)
        } else if (newEmail.indexOf('@') === -1) {
          // email invalid
          res.sendStatus(400)
        } else {
          // update the user email
          const auditLog = {
            initiatorId: userId,
            ipAddress: req.ip,
          }
          UserUpdater.changeEmailAddress(userId, newEmail, auditLog, err => {
            if (err) {
              if (err instanceof Errors.EmailExistsError) {
                const translation = req.i18n.translate(
                  'email_already_registered'
                )
                return HttpErrorHandler.conflict(req, res, translation)
              } else {
                return HttpErrorHandler.legacyInternal(
                  req,
                  res,
                  req.i18n.translate('problem_changing_email_address'),
                  OError.tag(err, 'problem_changing_email_address', {
                    userId,
                    newEmail,
                  })
                )
              }
            }
            User.findById(userId, (err, user) => {
              if (err != null) {
                logger.err(
                  { err, userId },
                  'error getting user for email update'
                )
                return res.sendStatus(500)
              }
              SessionManager.setInSessionUser(req.session, {
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
              })
              UserHandler.populateTeamInvites(user, err => {
                // need to refresh this in the background
                if (err != null) {
                  logger.err({ err }, 'error populateTeamInvites')
                }
                res.sendStatus(200)
              })
            })
          })
        }
      })
    })
  },

  doLogout(req, cb) {
    metrics.inc('user.logout')
    const user = SessionManager.getSessionUser(req.session)
    logger.debug({ user }, 'logging out')
    const sessionId = req.sessionID
    if (typeof req.logout === 'function') {
      req.logout()
    } // passport logout
    req.session.destroy(err => {
      if (err) {
        OError.tag(err, 'error destroying session')
        return cb(err)
      }
      if (user != null) {
        UserSessionsManager.untrackSession(user, sessionId, () => {})
      }
      cb()
    })
  },

  logout(req, res, next) {
    const requestedRedirect = req.body.redirect
      ? UrlHelper.getSafeRedirectPath(req.body.redirect)
      : undefined
    const redirectUrl = requestedRedirect || '/login'

    UserController.doLogout(req, err => {
      if (err != null) {
        return next(err)
      }
      if (acceptsJson(req)) {
        res.status(200).json({ redir: redirectUrl })
      } else {
        res.redirect(redirectUrl)
      }
    })
  },

  expireDeletedUser(req, res, next) {
    const userId = req.params.userId
    UserDeleter.expireDeletedUser(userId, error => {
      if (error) {
        return next(error)
      }

      res.sendStatus(204)
    })
  },

  expireDeletedUsersAfterDuration(req, res, next) {
    UserDeleter.expireDeletedUsersAfterDuration(error => {
      if (error) {
        return next(error)
      }

      res.sendStatus(204)
    })
  },

  changePassword: expressify(changePassword),
}

UserController.promises = {
  doLogout: promisify(UserController.doLogout),
  ensureAffiliation,
  ensureAffiliationMiddleware,
}

module.exports = UserController
