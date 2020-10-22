const PasswordResetHandler = require('./PasswordResetHandler')
const RateLimiter = require('../../infrastructure/RateLimiter')
const AuthenticationController = require('../Authentication/AuthenticationController')
const UserGetter = require('../User/UserGetter')
const UserUpdater = require('../User/UserUpdater')
const UserSessionsManager = require('../User/UserSessionsManager')
const OError = require('@overleaf/o-error')
const { expressify } = require('../../util/promises')

async function setNewUserPassword(req, res, next) {
  let user
  let { passwordResetToken, password } = req.body
  if (!passwordResetToken || !password) {
    return res.sendStatus(400)
  }
  passwordResetToken = passwordResetToken.trim()
  delete req.session.resetToken

  const initiatorId = AuthenticationController.getLoggedInUserId(req)
  // password reset via tokens can be done while logged in, or not
  const auditLog = {
    initiatorId,
    ip: req.ip
  }

  try {
    const result = await PasswordResetHandler.promises.setNewUserPassword(
      passwordResetToken,
      password,
      auditLog
    )
    let { found, reset, userId } = result
    if (!found) return res.sendStatus(404)
    if (!reset) return res.sendStatus(500)
    await UserSessionsManager.promises.revokeAllUserSessions(
      { _id: userId },
      []
    )
    await UserUpdater.promises.removeReconfirmFlag(userId)
    if (!req.session.doLoginAfterPasswordReset) {
      return res.sendStatus(200)
    }
    user = await UserGetter.promises.getUser(userId)
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return res.sendStatus(404)
    } else if (error.name === 'InvalidPasswordError') {
      return res.sendStatus(400)
    } else {
      return res.sendStatus(500)
    }
  }

  AuthenticationController.finishLogin(user, req, res, next)
}

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
        return next(
          new OError('rate-limit password reset failed').withCause(err)
        )
      }
      if (!canContinue) {
        return res.status(429).send({
          message: req.i18n.translate('rate_limit_hit_wait')
        })
      }
      PasswordResetHandler.generateAndEmailResetToken(email, (err, status) => {
        if (err != null) {
          OError.tag(err, 'failed to generate and email password reset token', {
            email
          })
          next(err)
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

  setNewUserPassword: expressify(setNewUserPassword)
}
