/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
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
let UserController
const UserHandler = require('./UserHandler')
const UserDeleter = require('./UserDeleter')
const UserGetter = require('./UserGetter')
const { User } = require('../../models/User')
const newsLetterManager = require('../Newsletter/NewsletterManager')
const UserRegistrationHandler = require('./UserRegistrationHandler')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const Url = require('url')
const AuthenticationManager = require('../Authentication/AuthenticationManager')
const AuthenticationController = require('../Authentication/AuthenticationController')
const UserSessionsManager = require('./UserSessionsManager')
const UserUpdater = require('./UserUpdater')
const SudoModeHandler = require('../SudoMode/SudoModeHandler')
const settings = require('settings-sharelatex')
const Errors = require('../Errors/Errors')

module.exports = UserController = {
  tryDeleteUser(req, res, next) {
    return UserController._tryDeleteUser(UserDeleter.deleteUser, req, res, next)
  },

  trySoftDeleteUser(req, res, next) {
    return UserController._tryDeleteUser(
      UserDeleter.softDeleteUser,
      req,
      res,
      next
    )
  },

  _tryDeleteUser(deleteMethod, req, res, next) {
    const user_id = AuthenticationController.getLoggedInUserId(req)
    const { password } = req.body
    logger.log({ user_id }, 'trying to delete user account')
    if (password == null || password === '') {
      logger.err(
        { user_id },
        'no password supplied for attempt to delete account'
      )
      return res.sendStatus(403)
    }
    return AuthenticationManager.authenticate(
      { _id: user_id },
      password,
      function(err, user) {
        if (err != null) {
          logger.warn(
            { user_id },
            'error authenticating during attempt to delete account'
          )
          return next(err)
        }
        if (!user) {
          logger.err(
            { user_id },
            'auth failed during attempt to delete account'
          )
          return res.sendStatus(403)
        }
        return deleteMethod(user_id, function(err) {
          if (err != null) {
            if (err instanceof Errors.SubscriptionAdminDeletionError) {
              return res.status(422).json({ error: err.name })
            } else {
              logger.warn({ user_id }, 'error while deleting user account')
              return next(err)
            }
          }
          const sessionId = req.sessionID
          if (typeof req.logout === 'function') {
            req.logout()
          }
          return req.session.destroy(function(err) {
            if (err != null) {
              logger.warn({ err }, 'error destorying session')
              return next(err)
            }
            UserSessionsManager.untrackSession(user, sessionId)
            return res.sendStatus(200)
          })
        })
      }
    )
  },

  unsubscribe(req, res) {
    const user_id = AuthenticationController.getLoggedInUserId(req)
    return UserGetter.getUser(user_id, (err, user) =>
      newsLetterManager.unsubscribe(user, () => res.send())
    )
  },

  updateUserSettings(req, res) {
    const user_id = AuthenticationController.getLoggedInUserId(req)
    logger.log({ user_id }, 'updating account settings')
    return User.findById(user_id, function(err, user) {
      if (err != null || user == null) {
        logger.err({ err, user_id }, 'problem updaing user settings')
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

      return user.save(function(err) {
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
          return res.sendStatus(200)
        } else if (newEmail.indexOf('@') === -1) {
          // email invalid
          return res.sendStatus(400)
        } else {
          // update the user email
          return UserUpdater.changeEmailAddress(user_id, newEmail, function(
            err
          ) {
            if (err != null) {
              let message
              logger.err(
                { err, user_id, newEmail },
                'problem updaing users email address'
              )
              if (err instanceof Errors.EmailExistsError) {
                message = req.i18n.translate('email_already_registered')
              } else {
                message = req.i18n.translate('problem_changing_email_address')
              }
              return res.send(500, { message })
            }
            return User.findById(user_id, function(err, user) {
              if (err != null) {
                logger.err(
                  { err, user_id },
                  'error getting user for email update'
                )
                return res.send(500)
              }
              AuthenticationController.setInSessionUser(req, {
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name
              })
              return UserHandler.populateTeamInvites(user, function(err) {
                // need to refresh this in the background
                if (err != null) {
                  logger.err({ err }, 'error populateTeamInvites')
                }
                return res.sendStatus(200)
              })
            })
          })
        }
      })
    })
  },

  _doLogout(req, cb) {
    if (cb == null) {
      cb = function(err) {}
    }
    metrics.inc('user.logout')
    const user = AuthenticationController.getSessionUser(req)
    logger.log({ user }, 'logging out')
    const sessionId = req.sessionID
    if (typeof req.logout === 'function') {
      req.logout()
    } // passport logout
    return req.session.destroy(function(err) {
      if (err) {
        logger.warn({ err }, 'error destorying session')
        cb(err)
      }
      if (user != null) {
        UserSessionsManager.untrackSession(user, sessionId)
        SudoModeHandler.clearSudoMode(user._id)
      }
      return cb()
    })
  },

  logout(req, res, next) {
    return UserController._doLogout(req, function(err) {
      if (err != null) {
        return next(err)
      }
      const redirect_url =
        settings.overleaf != null
          ? settings.overleaf.host + '/users/ensure_signed_out'
          : '/login'
      return res.redirect(redirect_url)
    })
  },

  register(req, res, next) {
    if (next == null) {
      next = function(error) {}
    }
    const { email } = req.body
    if (email == null || email === '') {
      res.sendStatus(422) // Unprocessable Entity
      return
    }
    return UserRegistrationHandler.registerNewUserAndSendActivationEmail(
      email,
      function(error, user, setNewPasswordUrl) {
        if (error != null) {
          return next(error)
        }
        return res.json({
          email: user.email,
          setNewPasswordUrl
        })
      }
    )
  },

  clearSessions(req, res, next) {
    if (next == null) {
      next = function(error) {}
    }
    metrics.inc('user.clear-sessions')
    const user = AuthenticationController.getSessionUser(req)
    logger.log({ user_id: user._id }, 'clearing sessions for user')
    return UserSessionsManager.revokeAllUserSessions(
      user,
      [req.sessionID],
      function(err) {
        if (err != null) {
          return next(err)
        }
        return res.sendStatus(201)
      }
    )
  },

  changePassword(req, res, next) {
    if (next == null) {
      next = function(error) {}
    }
    metrics.inc('user.password-change')
    const oldPass = req.body.currentPassword
    const user_id = AuthenticationController.getLoggedInUserId(req)
    return AuthenticationManager.authenticate(
      { _id: user_id },
      oldPass,
      function(err, user) {
        if (err != null) {
          return next(err)
        }
        if (user) {
          logger.log({ user: user._id }, 'changing password')
          const { newPassword1 } = req.body
          const { newPassword2 } = req.body
          const validationError = AuthenticationManager.validatePassword(
            newPassword1
          )
          if (newPassword1 !== newPassword2) {
            logger.log({ user }, 'passwords do not match')
            return res.send({
              message: {
                type: 'error',
                text: 'Your passwords do not match'
              }
            })
          } else if (validationError != null) {
            logger.log({ user }, validationError.message)
            return res.send({
              message: {
                type: 'error',
                text: validationError.message
              }
            })
          } else {
            logger.log({ user }, 'password changed')
            return AuthenticationManager.setUserPassword(
              user._id,
              newPassword1,
              function(error) {
                if (error != null) {
                  return next(error)
                }
                return UserSessionsManager.revokeAllUserSessions(
                  user,
                  [req.sessionID],
                  function(err) {
                    if (err != null) {
                      return next(err)
                    }
                    return res.send({
                      message: {
                        type: 'success',
                        text: 'Your password has been changed'
                      }
                    })
                  }
                )
              }
            )
          }
        } else {
          logger.log({ user_id }, 'current password wrong')
          return res.send({
            message: {
              type: 'error',
              text: 'Your old password is wrong'
            }
          })
        }
      }
    )
  }
}
