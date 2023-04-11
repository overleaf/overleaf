const PasswordResetHandler = require('./PasswordResetHandler')
const AuthenticationController = require('../Authentication/AuthenticationController')
const AuthenticationManager = require('../Authentication/AuthenticationManager')
const SessionManager = require('../Authentication/SessionManager')
const UserGetter = require('../User/UserGetter')
const UserUpdater = require('../User/UserUpdater')
const UserSessionsManager = require('../User/UserSessionsManager')
const OError = require('@overleaf/o-error')
const EmailsHelper = require('../Helpers/EmailHelper')
const { expressify } = require('../../util/promises')

async function setNewUserPassword(req, res, next) {
  let user
  let { passwordResetToken, password, email } = req.body
  if (!passwordResetToken || !password) {
    return res.status(400).json({
      message: {
        key: 'invalid-password',
      },
    })
  }

  const err = AuthenticationManager.validatePassword(password, email)
  if (err) {
    const message = AuthenticationManager.getMessageForInvalidPasswordError(
      err,
      req
    )
    return res.status(400).json({ message })
  }

  passwordResetToken = passwordResetToken.trim()
  delete req.session.resetToken

  const initiatorId = SessionManager.getLoggedInUserId(req.session)
  // password reset via tokens can be done while logged in, or not
  const auditLog = {
    initiatorId,
    ip: req.ip,
  }

  try {
    const result = await PasswordResetHandler.promises.setNewUserPassword(
      passwordResetToken,
      password,
      auditLog
    )
    const { found, reset, userId } = result
    if (!found) {
      return res.status(404).json({
        message: {
          key: 'token-expired',
        },
      })
    }
    if (!reset) {
      return res.status(500).json({
        message: req.i18n.translate('error_performing_request'),
      })
    }
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
      return res.status(404).json({
        message: {
          key: 'token-expired',
        },
      })
    } else if (error.name === 'InvalidPasswordError') {
      return res.status(400).json({
        message: {
          key: 'invalid-password',
        },
      })
    } else if (error.name === 'PasswordMustBeDifferentError') {
      return res.status(400).json({
        message: {
          key: 'password-must-be-different',
        },
      })
    } else if (error.name === 'PasswordReusedError') {
      return res.status(400).json({
        message: {
          key: 'password-must-be-strong',
        },
      })
    } else {
      return res.status(500).json({
        message: req.i18n.translate('error_performing_request'),
      })
    }
  }
  AuthenticationController.setAuditInfo(req, {
    method: 'Password reset, set new password',
  })
  AuthenticationController.finishLogin(user, req, res, next)
}

module.exports = {
  renderRequestResetForm(req, res) {
    const errorQuery = req.query.error
    let error = null
    if (errorQuery === 'token_expired') {
      error = 'password_reset_token_expired'
    }
    res.render('user/passwordReset', {
      title: 'reset_password',
      error,
    })
  },

  requestReset(req, res, next) {
    const email = EmailsHelper.parseEmail(req.body.email)
    if (!email) {
      return res.status(400).json({
        message: req.i18n.translate('must_be_email_address'),
      })
    }
    PasswordResetHandler.generateAndEmailResetToken(email, (err, status) => {
      if (err != null) {
        OError.tag(err, 'failed to generate and email password reset token', {
          email,
        })
        next(err)
      } else if (status === 'primary') {
        res.status(200).json({
          message: req.i18n.translate('password_reset_email_sent'),
        })
      } else if (status === 'secondary') {
        res.status(404).json({
          message: req.i18n.translate('secondary_email_password_reset'),
        })
      } else {
        res.status(404).json({
          message: req.i18n.translate('cant_find_email'),
        })
      }
    })
  },

  renderSetPasswordForm(req, res) {
    if (req.query.passwordResetToken != null) {
      return PasswordResetHandler.getUserForPasswordResetToken(
        req.query.passwordResetToken,
        (err, user, remainingUses) => {
          if (err || !user || remainingUses <= 0) {
            return res.redirect('/user/password/reset?error=token_expired')
          }
          req.session.resetToken = req.query.passwordResetToken
          let emailQuery = ''
          if (typeof req.query.email === 'string') {
            const email = EmailsHelper.parseEmail(req.query.email)
            if (email) {
              emailQuery = `?email=${encodeURIComponent(email)}`
            }
          }
          return res.redirect('/user/password/set' + emailQuery)
        }
      )
    }
    if (req.session.resetToken == null) {
      return res.redirect('/user/password/reset')
    }
    const email = EmailsHelper.parseEmail(req.query.email)
    res.render('user/setPassword', {
      title: 'set_password',
      email,
      passwordResetToken: req.session.resetToken,
    })
  },

  setNewUserPassword: expressify(setNewUserPassword),
}
