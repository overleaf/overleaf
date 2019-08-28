const UserHandler = require('./UserHandler')
const UserDeleter = require('./UserDeleter')
const UserGetter = require('./UserGetter')
const { User } = require('../../models/User')
const NewsletterManager = require('../Newsletter/NewsletterManager')
const UserRegistrationHandler = require('./UserRegistrationHandler')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const AuthenticationManager = require('../Authentication/AuthenticationManager')
const AuthenticationController = require('../Authentication/AuthenticationController')
const UserSessionsManager = require('./UserSessionsManager')
const UserUpdater = require('./UserUpdater')
const SudoModeHandler = require('../SudoMode/SudoModeHandler')
const Errors = require('../Errors/Errors')
const OError = require('@overleaf/o-error')
const HttpErrors = require('@overleaf/o-error/http')
const EmailHandler = require('../Email/EmailHandler')

const UserController = {
  tryDeleteUser(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    const { password } = req.body
    logger.log({ userId }, 'trying to delete user account')
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
          logger.warn(
            { userId },
            'error authenticating during attempt to delete account'
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
              let errorData = {
                message: 'error while deleting user account',
                info: { userId }
              }
              if (err instanceof Errors.SubscriptionAdminDeletionError) {
                // set info.public.error for JSON response so frontend can display
                // a specific message
                errorData.info.public = {
                  error: 'SubscriptionAdminDeletionError'
                }
                return next(
                  new HttpErrors.UnprocessableEntityError(errorData).withCause(
                    err
                  )
                )
              } else {
                return next(new OError(errorData).withCause(err))
              }
            }
            const sessionId = req.sessionID
            if (typeof req.logout === 'function') {
              req.logout()
            }
            req.session.destroy(err => {
              if (err != null) {
                logger.warn({ err }, 'error destorying session')
                return next(err)
              }
              UserSessionsManager.untrackSession(user, sessionId)
              res.sendStatus(200)
            })
          }
        )
      }
    )
  },

  unsubscribe(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    UserGetter.getUser(userId, (err, user) => {
      if (err != null) {
        return next(err)
      }
      NewsletterManager.unsubscribe(user, err => {
        if (err != null) {
          logger.warn(
            { err, user },
            'Failed to unsubscribe user from newsletter'
          )
        }
        res.send()
      })
    })
  },

  updateUserSettings(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    logger.log({ userId }, 'updating account settings')
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
          AuthenticationController.setInSessionUser(req, {
            first_name: user.first_name,
            last_name: user.last_name
          })
          res.sendStatus(200)
        } else if (newEmail.indexOf('@') === -1) {
          // email invalid
          res.sendStatus(400)
        } else {
          // update the user email
          UserUpdater.changeEmailAddress(userId, newEmail, err => {
            if (err) {
              let errorData = {
                message: 'problem updaing users email address',
                info: { userId, newEmail, public: {} }
              }
              if (err instanceof Errors.EmailExistsError) {
                errorData.info.public.message = req.i18n.translate(
                  'email_already_registered'
                )
                return next(
                  new HttpErrors.ConflictError(errorData).withCause(err)
                )
              } else {
                errorData.info.public.message = req.i18n.translate(
                  'problem_changing_email_address'
                )
                next(
                  new HttpErrors.InternalServerError(errorData).withCause(err)
                )
              }
            }
            User.findById(userId, (err, user) => {
              if (err != null) {
                logger.err(
                  { err, userId },
                  'error getting user for email update'
                )
                return res.send(500)
              }
              AuthenticationController.setInSessionUser(req, {
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name
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

  _doLogout(req, cb) {
    metrics.inc('user.logout')
    const user = AuthenticationController.getSessionUser(req)
    logger.log({ user }, 'logging out')
    const sessionId = req.sessionID
    if (typeof req.logout === 'function') {
      req.logout()
    } // passport logout
    req.session.destroy(err => {
      if (err) {
        logger.warn({ err }, 'error destorying session')
        return cb(err)
      }
      if (user != null) {
        UserSessionsManager.untrackSession(user, sessionId)
        SudoModeHandler.clearSudoMode(user._id)
      }
      cb()
    })
  },

  logout(req, res, next) {
    UserController._doLogout(req, err => {
      if (err != null) {
        return next(err)
      }
      const redirectUrl = '/login'
      res.redirect(redirectUrl)
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

  register(req, res, next) {
    const { email } = req.body
    if (email == null || email === '') {
      return res.sendStatus(422) // Unprocessable Entity
    }
    UserRegistrationHandler.registerNewUserAndSendActivationEmail(
      email,
      (error, user, setNewPasswordUrl) => {
        if (error != null) {
          return next(error)
        }
        res.json({
          email: user.email,
          setNewPasswordUrl
        })
      }
    )
  },

  clearSessions(req, res, next) {
    metrics.inc('user.clear-sessions')
    const user = AuthenticationController.getSessionUser(req)
    logger.log({ userId: user._id }, 'clearing sessions for user')
    UserSessionsManager.revokeAllUserSessions(user, [req.sessionID], err => {
      if (err != null) {
        return next(err)
      }
      res.sendStatus(201)
    })
  },

  changePassword(req, res, next) {
    metrics.inc('user.password-change')
    const internalError = {
      message: { type: 'error', text: req.i18n.translate('internal_error') }
    }
    const userId = AuthenticationController.getLoggedInUserId(req)
    AuthenticationManager.authenticate(
      { _id: userId },
      req.body.currentPassword,
      (err, user) => {
        if (err) {
          return res.status(500).json(internalError)
        }
        if (!user) {
          return res.status(400).json({
            message: {
              type: 'error',
              text: 'Your old password is wrong'
            }
          })
        }
        if (req.body.newPassword1 !== req.body.newPassword2) {
          return res.status(400).json({
            message: {
              type: 'error',
              text: req.i18n.translate('password_change_passwords_do_not_match')
            }
          })
        }
        const validationError = AuthenticationManager.validatePassword(
          req.body.newPassword1
        )
        if (validationError != null) {
          return res.status(400).json({
            message: {
              type: 'error',
              text: validationError.message
            }
          })
        }
        AuthenticationManager.setUserPassword(
          user._id,
          req.body.newPassword1,
          err => {
            if (err) {
              return res.status(500).json(internalError)
            }
            // log errors but do not wait for response
            EmailHandler.sendEmail(
              'passwordChanged',
              { to: user.email },
              err => {
                if (err) {
                  logger.warn(err)
                }
              }
            )
            UserSessionsManager.revokeAllUserSessions(
              user,
              [req.sessionID],
              err => {
                if (err != null) {
                  return res.status(500).json(internalError)
                }
                res.json({
                  message: {
                    type: 'success',
                    email: user.email,
                    text: req.i18n.translate('password_change_successful')
                  }
                })
              }
            )
          }
        )
      }
    )
  }
}

module.exports = UserController
