const PasswordResetHandler = require('./PasswordResetHandler')
const RateLimiter = require('../../infrastructure/RateLimiter')
const AuthenticationController = require('../Authentication/AuthenticationController')
const AuthenticationManager = require('../Authentication/AuthenticationManager')
const UserGetter = require('../User/UserGetter')
const UserUpdater = require('../User/UserUpdater')
const UserSessionsManager = require('../User/UserSessionsManager')
const logger = require('logger-sharelatex')
const Settings = require('settings-sharelatex')

module.exports = {
  renderRequestResetForm(req, res) {
    logger.log('rendering request reset form')
    res.render('user/passwordReset', { title: 'reset_password' })
  },

  requestReset(req, res, next) {
    const email = req.body.email.trim().toLowerCase()
    const opts = {
      endpointName: 'password_reset_rate_limit',
      timeInterval: 60,
      subjectName: req.ip,
      throttle: 6
    }
    RateLimiter.addCount(opts, function(err, canContinue) {
      if (err != null) {
        return next(err)
      }
      if (!canContinue) {
        return res.send(429, {
          message: req.i18n.translate('rate_limit_hit_wait')
        })
      }
      PasswordResetHandler.generateAndEmailResetToken(email, function(
        err,
        status
      ) {
        if (err != null) {
          res.send(500, {
            message: err.message
          })
        } else if (status === 'primary') {
          res.send(200, {
            message: { text: req.i18n.translate('password_reset_email_sent') }
          })
        } else if (status === 'secondary') {
          res.send(404, {
            message: req.i18n.translate('secondary_email_password_reset')
          })
        } else if (status === 'sharelatex') {
          res.send(404, {
            message: `<a href="${
              Settings.accountMerge.sharelatexHost
            }/user/password/reset">${req.i18n.translate('reset_from_sl')}</a>`
          })
        } else {
          res.send(404, {
            message: req.i18n.translate('cant_find_email')
          })
        }
      })
    })
  },

  renderSetPasswordForm(req, res) {
    if (req.query.passwordResetToken != null) {
      req.session.resetToken = req.query.passwordResetToken
      return res.redirect('/user/password/set')
    }
    if (req.session.resetToken == null) {
      return res.redirect('/user/password/reset')
    }
    res.render('user/setPassword', {
      title: 'set_password',
      passwordResetToken: req.session.resetToken
    })
  },

  setNewUserPassword(req, res, next) {
    const { passwordResetToken, password } = req.body
    if (
      !password ||
      !passwordResetToken ||
      AuthenticationManager.validatePassword(password.trim()) != null
    ) {
      return res.sendStatus(400)
    }
    delete req.session.resetToken
    PasswordResetHandler.setNewUserPassword(
      passwordResetToken.trim(),
      password.trim(),
      function(err, found, userId) {
        if (err && err.name && err.name === 'NotFoundError') {
          res.status(404).send('NotFoundError')
        } else if (err && err.name && err.name === 'NotInV2Error') {
          res.status(403).send('NotInV2Error')
        } else if (err && err.name && err.name === 'SLInV2Error') {
          res.status(403).send('SLInV2Error')
        } else if (err && err.statusCode && err.statusCode === 500) {
          res.status(500)
        } else if (err && !err.statusCode) {
          res.status(500)
        } else if (found) {
          if (userId == null) {
            return res.sendStatus(200)
          } // will not exist for v1-only users
          UserSessionsManager.revokeAllUserSessions(
            { _id: userId },
            [],
            function(err) {
              if (err != null) {
                return next(err)
              }
              UserUpdater.removeReconfirmFlag(userId, function(err) {
                if (err != null) {
                  return next(err)
                }
                if (req.body.login_after) {
                  UserGetter.getUser(userId, { email: 1 }, function(err, user) {
                    if (err != null) {
                      return next(err)
                    }
                    AuthenticationController.afterLoginSessionSetup(
                      req,
                      user,
                      function(err) {
                        if (err != null) {
                          logger.warn(
                            { err, email: user.email },
                            'Error setting up session after setting password'
                          )
                          return next(err)
                        }
                        res.json({
                          redir:
                            AuthenticationController._getRedirectFromSession(
                              req
                            ) || '/project'
                        })
                      }
                    )
                  })
                } else {
                  res.sendStatus(200)
                }
              })
            }
          )
        } else {
          res.sendStatus(404)
        }
      }
    )
  }
}
