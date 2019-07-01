/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-useless-escape,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
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
    return res.render('user/passwordReset', { title: 'reset_password' })
  },

  requestReset(req, res) {
    const email = req.body.email.trim().toLowerCase()
    const opts = {
      endpointName: 'password_reset_rate_limit',
      timeInterval: 60,
      subjectName: req.ip,
      throttle: 6
    }
    return RateLimiter.addCount(opts, function(err, canContinue) {
      if (!canContinue) {
        return res.send(429, {
          message: req.i18n.translate('rate_limit_hit_wait')
        })
      }
      return PasswordResetHandler.generateAndEmailResetToken(email, function(
        err,
        status
      ) {
        if (err != null) {
          return res.send(500, {
            message: err != null ? err.message : undefined
          })
        } else if (status === 'primary') {
          return res.send(200, {
            message: { text: req.i18n.translate('password_reset_email_sent') }
          })
        } else if (status === 'secondary') {
          return res.send(404, {
            message: req.i18n.translate('secondary_email_password_reset')
          })
        } else if (status === 'sharelatex') {
          return res.send(404, {
            message: `<a href=\"${
              Settings.accountMerge.sharelatexHost
            }/user/password/reset\">${req.i18n.translate('reset_from_sl')}</a>`
          })
        } else {
          return res.send(404, {
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
    return res.render('user/setPassword', {
      title: 'set_password',
      passwordResetToken: req.session.resetToken
    })
  },

  setNewUserPassword(req, res, next) {
    const { passwordResetToken, password } = req.body
    if (
      password == null ||
      password.length === 0 ||
      passwordResetToken == null ||
      passwordResetToken.length === 0 ||
      AuthenticationManager.validatePassword(
        password != null ? password.trim() : undefined
      ) != null
    ) {
      return res.sendStatus(400)
    }
    delete req.session.resetToken
    return PasswordResetHandler.setNewUserPassword(
      passwordResetToken != null ? passwordResetToken.trim() : undefined,
      password != null ? password.trim() : undefined,
      function(err, found, user_id) {
        if (err && err.name && err.name === 'NotFoundError') {
          return res.status(404).send('NotFoundError')
        } else if (err && err.name && err.name === 'NotInV2Error') {
          return res.status(403).send('NotInV2Error')
        } else if (err && err.name && err.name === 'SLInV2Error') {
          return res.status(403).send('SLInV2Error')
        } else if (err && err.statusCode && err.statusCode === 500) {
          return res.status(500)
        } else if (err && !err.statusCode) {
          return res.status(500)
        } else if (found) {
          if (user_id == null) {
            return res.sendStatus(200)
          } // will not exist for v1-only users
          return UserSessionsManager.revokeAllUserSessions(
            { _id: user_id },
            [],
            function(err) {
              if (err != null) {
                return next(err)
              }
              return UserUpdater.removeReconfirmFlag(user_id, function(err) {
                if (err != null) {
                  return next(err)
                }
                if (req.body.login_after) {
                  return UserGetter.getUser(user_id, { email: 1 }, function(
                    err,
                    user
                  ) {
                    if (err != null) {
                      return next(err)
                    }
                    return AuthenticationController.afterLoginSessionSetup(
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
                        return res.json({
                          redir:
                            AuthenticationController._getRedirectFromSession(
                              req
                            ) || '/project'
                        })
                      }
                    )
                  })
                } else {
                  return res.sendStatus(200)
                }
              })
            }
          )
        } else {
          return res.sendStatus(404)
        }
      }
    )
  }
}
