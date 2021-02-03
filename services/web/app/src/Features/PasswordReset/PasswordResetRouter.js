const PasswordResetController = require('./PasswordResetController')
const AuthenticationController = require('../Authentication/AuthenticationController')
const { Joi, validate } = require('../../infrastructure/Validation')

module.exports = {
  apply(webRouter, apiRouter) {
    webRouter.get(
      '/user/password/reset',
      PasswordResetController.renderRequestResetForm
    )
    webRouter.post(
      '/user/password/reset',
      validate({
        body: Joi.object({
          email: Joi.string().required()
        })
      }),
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
          passwordResetToken: Joi.string().required()
        })
      }),
      PasswordResetController.setNewUserPassword
    )
    AuthenticationController.addEndpointToLoginWhitelist('/user/password/set')

    webRouter.post(
      '/user/reconfirm',
      validate({
        body: Joi.object({
          email: Joi.string().required()
        })
      }),
      PasswordResetController.requestReset
    )
  }
}
