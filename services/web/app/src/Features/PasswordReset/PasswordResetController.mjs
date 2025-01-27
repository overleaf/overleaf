import PasswordResetHandler from './PasswordResetHandler.mjs'
import AuthenticationController from '../Authentication/AuthenticationController.js'
import AuthenticationManager from '../Authentication/AuthenticationManager.js'
import SessionManager from '../Authentication/SessionManager.js'
import UserGetter from '../User/UserGetter.js'
import UserUpdater from '../User/UserUpdater.js'
import UserSessionsManager from '../User/UserSessionsManager.js'
import OError from '@overleaf/o-error'
import EmailsHelper from '../Helpers/EmailHelper.js'
import { expressify } from '@overleaf/promise-utils'
import SplitTestHandler from '../SplitTests/SplitTestHandler.js'

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
    const { found, reset, userId, mustReconfirm } = result
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
    await UserSessionsManager.promises.removeSessionsFromRedis({ _id: userId })
    if (mustReconfirm) {
      await UserUpdater.promises.removeReconfirmFlag(userId, auditLog)
    }
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

async function requestReset(req, res, next) {
  const email = EmailsHelper.parseEmail(req.body.email)
  if (!email) {
    return res.status(400).json({
      message: req.i18n.translate('must_be_email_address'),
    })
  }

  let status
  try {
    status =
      await PasswordResetHandler.promises.generateAndEmailResetToken(email)
  } catch (err) {
    OError.tag(err, 'failed to generate and email password reset token', {
      email,
    })
    if (err.message === 'user does not have permission for change-password') {
      return res.status(403).json({
        message: {
          key: 'no-password-allowed-due-to-sso',
        },
      })
    }
    throw err
  }

  if (status === 'primary') {
    return res.status(200).json({
      message: req.i18n.translate('password_reset_email_sent'),
    })
  } else if (status === 'secondary') {
    return res.status(404).json({
      message: req.i18n.translate('secondary_email_password_reset'),
    })
  } else {
    return res.status(404).json({
      message: req.i18n.translate('cant_find_email'),
    })
  }
}

async function renderSetPasswordForm(req, res, next) {
  const { variant } = await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'auth-pages-bs5'
  )

  if (req.query.passwordResetToken != null) {
    try {
      const result =
        await PasswordResetHandler.promises.getUserForPasswordResetToken(
          req.query.passwordResetToken
        )

      const { user, remainingPeeks } = result || {}
      if (!user || remainingPeeks <= 0) {
        return res.redirect('/user/password/reset?error=token_expired')
      }
      req.session.resetToken = req.query.passwordResetToken
      if (variant === 'enabled') {
        req.session.setPasswordBS5 = true
      }

      let emailQuery = ''

      if (typeof req.query.email === 'string') {
        const email = EmailsHelper.parseEmail(req.query.email)
        if (email) {
          emailQuery = `?email=${encodeURIComponent(email)}`
        }
      }

      return res.redirect('/user/password/set' + emailQuery)
    } catch (err) {
      if (err.name === 'ForbiddenError') {
        return next(err)
      }
      return res.redirect('/user/password/reset?error=token_expired')
    }
  }

  if (req.session.resetToken == null) {
    return res.redirect('/user/password/reset')
  }

  const email = EmailsHelper.parseEmail(req.query.email)

  // clean up to avoid leaking the token in the session object
  const passwordResetToken = req.session.resetToken
  delete req.session.resetToken

  const template = req.session.setPasswordBS5
    ? 'user/setPassword-bs5'
    : 'user/setPassword'

  delete req.session.setPasswordBS5

  res.render(template, {
    title: 'set_password',
    email,
    passwordResetToken,
  })
}

async function renderRequestResetForm(req, res) {
  const errorQuery = req.query.error
  let error = null
  if (errorQuery === 'token_expired') {
    error = 'password_reset_token_expired'
  }
  const { variant } = await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'auth-pages-bs5'
  )

  const template =
    variant === 'enabled' ? 'user/passwordReset-bs5' : 'user/passwordReset'

  res.render(template, {
    title: 'reset_password',
    error,
  })
}

export default {
  renderRequestResetForm: expressify(renderRequestResetForm),
  requestReset: expressify(requestReset),
  renderSetPasswordForm: expressify(renderSetPasswordForm),
  setNewUserPassword: expressify(setNewUserPassword),
}
