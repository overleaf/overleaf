import PasswordResetController from './PasswordResetController.mjs'
import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import CaptchaMiddleware from '../../Features/Captcha/CaptchaMiddleware.mjs'
import { RateLimiter } from '../../infrastructure/RateLimiter.mjs'
import RateLimiterMiddleware from '../Security/RateLimiterMiddleware.mjs'

const rateLimiter = new RateLimiter('password_reset_rate_limit', {
  points: 6,
  duration: 60,
})

export default {
  apply(webRouter) {
    const rateLimit = RateLimiterMiddleware.rateLimit(rateLimiter, {
      ipOnly: true,
    })

    webRouter.get(
      '/user/password/reset',
      PasswordResetController.renderRequestResetForm
    )
    webRouter.post(
      '/user/password/reset',
      rateLimit,
      CaptchaMiddleware.validateCaptcha('passwordReset'),
      PasswordResetController.requestReset
    )
    AuthenticationController.addEndpointToLoginWhitelist('/user/password/reset')

    webRouter.get(
      '/user/password/set',
      rateLimit,
      PasswordResetController.renderSetPasswordForm
    )
    webRouter.post(
      '/user/password/set',
      rateLimit,
      PasswordResetController.setNewUserPassword
    )
    AuthenticationController.addEndpointToLoginWhitelist('/user/password/set')

    webRouter.post(
      '/user/reconfirm',
      rateLimit,
      CaptchaMiddleware.validateCaptcha('passwordReset'),
      PasswordResetController.requestReset
    )
  },

  rateLimiter,
}
