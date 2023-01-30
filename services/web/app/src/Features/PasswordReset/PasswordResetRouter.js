const PasswordResetController = require('./PasswordResetController')
const AuthenticationController = require('../Authentication/AuthenticationController')
const CaptchaMiddleware = require('../../Features/Captcha/CaptchaMiddleware')
const { RateLimiter } = require('../../infrastructure/RateLimiter')
const RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')
const { Joi, validate } = require('../../infrastructure/Validation')

const rateLimiter = new RateLimiter('password_reset_rate_limit', {
  points: 6,
  duration: 60,
})

module.exports = {
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
