import PasswordResetController from './PasswordResetController.mjs'
import AuthenticationController from '../Authentication/AuthenticationController.js'
import CaptchaMiddleware from '../../Features/Captcha/CaptchaMiddleware.js'
import { RateLimiter } from '../../infrastructure/RateLimiter.js'
import RateLimiterMiddleware from '../Security/RateLimiterMiddleware.js'
import { Joi, validate } from '../../infrastructure/Validation.js'

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
      validate({
        query: { error: Joi.string() },
      }),
      PasswordResetController.renderRequestResetForm
    )
    webRouter.post(
      '/user/password/reset',
      validate({
        body: Joi.object({
          email: Joi.string().required(),
        }),
      }),
      rateLimit,
      CaptchaMiddleware.validateCaptcha('passwordReset'),
      PasswordResetController.requestReset
    )
    AuthenticationController.addEndpointToLoginWhitelist('/user/password/reset')

    webRouter.get(
      '/user/password/set',
      validate({
        query: {
          email: Joi.string().required(),
          passwordResetToken: Joi.string(),
        },
      }),
      rateLimit,
      PasswordResetController.renderSetPasswordForm
    )
    webRouter.post(
      '/user/password/set',
      validate({
        body: Joi.object({
          password: Joi.string().required(),
          passwordResetToken: Joi.string().required(),
        }),
      }),
      rateLimit,
      PasswordResetController.setNewUserPassword
    )
    AuthenticationController.addEndpointToLoginWhitelist('/user/password/set')

    webRouter.post(
      '/user/reconfirm',
      validate({
        body: Joi.object({
          email: Joi.string().required(),
        }),
      }),
      rateLimit,
      CaptchaMiddleware.validateCaptcha('passwordReset'),
      PasswordResetController.requestReset
    )
  },

  rateLimiter,
}
