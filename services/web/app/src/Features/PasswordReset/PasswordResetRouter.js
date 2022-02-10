const PasswordResetController = require('./PasswordResetController')
const AuthenticationController = require('../Authentication/AuthenticationController')
const CaptchaMiddleware = require('../../Features/Captcha/CaptchaMiddleware')
const RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')
const { Joi, validate } = require('../../infrastructure/Validation')

module.exports = {
  apply(webRouter) {
    const rateLimit = RateLimiterMiddleware.rateLimit({
      endpointName: 'password_reset_rate_limit',
      ipOnly: true,
      maxRequests: 6,
      timeInterval: 60,
    })

    webRouter.get(
      '/user/password/reset',
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
}
