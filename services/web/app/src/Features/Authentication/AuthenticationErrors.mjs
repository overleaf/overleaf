import Metrics from '@overleaf/metrics'
import OError from '@overleaf/o-error'
import Settings from '@overleaf/settings'
import Errors from '../Errors/Errors.js'

export class InvalidEmailError extends Errors.BackwardCompatibleError {}
export class InvalidPasswordError extends Errors.BackwardCompatibleError {}
export class ParallelLoginError extends Errors.BackwardCompatibleError {}
export class PasswordMustBeDifferentError
  extends Errors.BackwardCompatibleError {}
export class PasswordReusedError extends Errors.BackwardCompatibleError {}

export function handleAuthenticateErrors(error, req) {
  if (error.message === 'password is too long') {
    Metrics.inc('login_failure_reason', 1, {
      status: 'password_is_too_long',
    })
    return {
      status: 422,
      type: 'error',
      key: 'password-too-long',
      text: req.i18n.translate('password_too_long_please_reset'),
    }
  }
  if (error instanceof ParallelLoginError) {
    Metrics.inc('login_failure_reason', 1, { status: 'parallel_login' })
    return { status: 429 }
  }
  if (error instanceof PasswordReusedError) {
    Metrics.inc('login_failure_reason', 1, {
      status: 'password_compromised',
    })
    const text = `${req.i18n
      .translate('password_compromised_try_again_or_use_known_device_or_reset')
      .replace('<0>', '')
      .replace('</0>', ' (https://haveibeenpwned.com/passwords)')
      .replace('<1>', '')
      .replace('</1>', ` (${Settings.siteUrl}/user/password/reset)`)}.`
    return {
      status: 400,
      type: 'error',
      key: 'password-compromised',
      text,
    }
  }
  Metrics.inc('login_failure_reason', 1, {
    status: error instanceof OError ? error.name : 'error',
  })
  throw error
}

export default {
  InvalidEmailError,
  InvalidPasswordError,
  ParallelLoginError,
  PasswordMustBeDifferentError,
  PasswordReusedError,
  handleAuthenticateErrors,
}
