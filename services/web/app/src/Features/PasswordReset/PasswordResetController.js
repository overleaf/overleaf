const PasswordResetHandler = require('./PasswordResetHandler')
const RateLimiter = require('../../infrastructure/RateLimiter')
const AuthenticationController = require('../Authentication/AuthenticationController')
const AuthenticationManager = require('../Authentication/AuthenticationManager')
const UserGetter = require('../User/UserGetter')
const UserUpdater = require('../User/UserUpdater')
const UserSessionsManager = require('../User/UserSessionsManager')
const logger = require('logger-sharelatex')

module.exports = {
  renderRequestResetForm(req, res) {
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
    RateLimiter.addCount(opts, (err, canContinue) => {
      if (err != null) {
        res.status(500).send({ message: err.message })
      }
      if (!canContinue) {
        return res.status(429).send({
          message: req.i18n.translate('rate_limit_hit_wait')
        })
      }
      PasswordResetHandler.generateAndEmailResetToken(email, (err, status) => {
        if (err != null) {
          logger.warn(
            { err },
            'failed to generate and email password reset token'
          )
          res.status(500).send({ message: err.message })
        } else if (status === 'primary') {
          res.status(200).send({
            message: { text: req.i18n.translate('password_reset_email_sent') }
          })
        } else if (status === 'secondary') {
          res.status(404).send({
            message: req.i18n.translate('secondary_email_password_reset')
          })
        } else {
          res.status(404).send({
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
    let { passwordResetToken, password } = req.body
    if (!passwordResetToken || !password) {
      return res.sendStatus(400)
    }
    passwordResetToken = passwordResetToken.trim()
    if (AuthenticationManager.validatePassword(password) != null) {
      return res.sendStatus(400)
    }
    delete req.session.resetToken
    PasswordResetHandler.setNewUserPassword(
      passwordResetToken,
      password,
      (err, found, userId) => {
        if ((err && err.name === 'NotFoundError') || !found) {
          return res.status(404).send('NotFoundError')
        } else if (err) {
          return res.status(500)
        }
        UserSessionsManager.revokeAllUserSessions({ _id: userId }, [], err => {
          if (err != null) {
            return next(err)
          }
          UserUpdater.removeReconfirmFlag(userId, err => {
            if (err != null) {
              return next(err)
            }
            if (!req.session.doLoginAfterPasswordReset) {
              return res.sendStatus(200)
            }
            UserGetter.getUser(userId, (err, user) => {
              if (err != null) {
                return next(err)
              }
              AuthenticationController.finishLogin(user, req, res, err => {
                if (err != null) {
                  logger.err(
                    { err, email: user.email },
                    'Error setting up session after setting password'
                  )
                }
                next(err)
              })
            })
          })
        })
      }
    )
  }
}
